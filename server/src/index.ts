import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";
import { Op } from "sequelize";
import { initDb, sequelize, dbUriSummary } from "./db.js";
import { HttpError } from "./utils/httpUtils.js";
import {
  PORT,
  CORS_ORIGINS,
  RATE_LIMIT_PER_MIN,
  ENABLE_MOCK_AI,
  WEB_DIST,
  authRequired as ACCESS_REQUIRED,
  assertProductionConfig,
} from "./config.js";
import { requireAccessToken, socketAuthGuard } from "./utils/auth.js";
import datasetsRouter from "./routes/datasets.js";
import commentsRouter from "./routes/comments.js";
import alertsRouter from "./routes/alerts.js";
import analysisRouter from "./routes/analysis.js";
import simulateRouter from "./routes/simulate.js";
import feedsRouter, { demoFeedHandler, startFeed } from "./routes/feeds.js";
import { DatasetModel } from "./models.js";
import { listScenarios } from "./services/scenarioService.js";

// 生产强校验：密钥/CORS/限流/Mock AI/访问口令未配置则拒绝启动（开发模式跳过）
assertProductionConfig();
// 访问口令已启用？（未设 ACCESS_TOKEN 即开发模式，不启用认证）
const accessRequired = ACCESS_REQUIRED;
if (accessRequired) {
  console.log("[config] 访问口令认证已启用：所有 /api 与 socket.io 连接需携带 Bearer token");
}

if (!process.env.MYSQL_HOST && !process.env.MYSQL_USER && !process.env.MYSQL_PASSWORD) {
  console.warn("[config] 未设置 MYSQL_* 环境变量，使用默认本地 MySQL（root:1234@127.0.0.1:3306/plfx）。生产环境请通过环境变量配置！");
}
if (!accessRequired) {
  console.warn("[config] 未设置 ACCESS_TOKEN，认证未启用（开发模式）。公网部署必须设置访问口令！");
}
if (RATE_LIMIT_PER_MIN > 0) {
  console.log(`[config] 写接口限流已开启：${RATE_LIMIT_PER_MIN} 次/分钟/IP`);
} else {
  console.warn("[config] 写接口限流未开启（RATE_LIMIT_PER_MIN=0）。公网部署建议设置，如 60。");
}
if (ENABLE_MOCK_AI) {
  console.warn("[config] Mock AI 端点已开启（仅测试用，生产请保持关闭）");
}

// 进程级兜底：异步异常/未捕获异常只记日志，不崩进程
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection:", reason instanceof Error ? reason.stack ?? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException:", err.stack ?? err.message);
});

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: "10mb" }));

// 健康检查（公开）：容器编排 / 负载均衡探活用；DB 不可用返回 503
app.get("/healthz", async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

// 认证状态探测（公开）：前端据此决定是否展示访问口令输入
app.get("/api/auth/status", (_req, res) => {
  res.json({ authRequired: accessRequired });
});

// 轻量请求日志（含耗时；生产可换 morgan）
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[req] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// 写接口限流（简单内存滑动窗口：IP -> 时间戳数组）
const rateBuckets = new Map<string, number[]>();
app.use((req, res, next) => {
  if (RATE_LIMIT_PER_MIN <= 0) return next();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
  if (!req.path.startsWith("/api")) return next();
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const window = 60_000;
  const arr = (rateBuckets.get(ip) ?? []).filter((t) => now - t < window);
  if (arr.length >= RATE_LIMIT_PER_MIN) {
    return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
  }
  arr.push(now);
  rateBuckets.set(ip, arr);
  next();
});

const httpServer = createServer(app);

// socket.io：分析进度 + 实时评论流 + 告警推送（同一连接复用）
export const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGINS, methods: ["GET", "POST"] },
});
// 访问口令认证：握手时校验 auth.token，失败拒绝连接
io.use(socketAuthGuard);
io.on("connection", (socket) => {
  console.log("[socket] connected", socket.id);
  socket.on("join-dataset", async (datasetId: string) => {
    // 校验数据集存在，防止订阅任意 id
    try {
      const ok = await DatasetModel.findByPk(datasetId);
      if (!ok) return socket.emit("join-error", { datasetId, error: "数据集不存在" });
      socket.join(`dataset:${datasetId}`);
    } catch {
      socket.emit("join-error", { datasetId, error: "无效的数据集 id" });
    }
  });
  socket.on("leave-dataset", (datasetId: string) => {
    socket.leave(`dataset:${datasetId}`);
  });
});

// 访问口令认证：ACCESS_TOKEN 已设置时，所有 /api/* 必须携带 Bearer token（/api/auth/status 除外，已在上面注册）
app.use("/api", requireAccessToken);

app.use("/api/datasets", datasetsRouter);
app.use("/api/datasets", commentsRouter);
app.use("/api/datasets", analysisRouter);
app.use("/api/datasets", simulateRouter);
app.use("/api/datasets", feedsRouter);
app.use("/api/alerts", alertsRouter);

// 本地演示数据源（供 URL 定时抓取演示）
app.get("/api/demo/feed", demoFeedHandler);

// 内置场景列表
app.get("/api/scenarios", (_req, res) => {
  res.json({ scenarios: listScenarios() });
});

// 本地 Mock AI（测试用，不走外网）：返回与评论条数一致的随机分析结果
if (ENABLE_MOCK_AI) {
  app.post("/api/mock-ai/chat/completions", (req, res) => {
    const messages = req.body?.messages;
    let user = "";
    if (Array.isArray(messages)) {
      for (const m of messages as { role?: string; content?: string }[]) {
        if (m.role === "user") user = m.content ?? "";
      }
    }
    const n = Math.max(1, (String(user).match(/^\d+\./gm) ?? []).length);
    const roll = Math.random();
    const sentiment = roll < 0.4 ? "pos" : roll < 0.7 ? "neu" : "neg";
    const arr = Array.from({ length: n }, () => ({
      sentiment,
      sentimentScore: sentiment === "pos" ? 0.8 : sentiment === "neg" ? -0.8 : 0,
      topics: ["测试主题"],
      keywords: ["mock", "测试"],
    }));
    // 延迟 500ms，便于测试暂停/恢复/取消
    setTimeout(() => res.json({ choices: [{ message: { content: JSON.stringify(arr) } }] }), 500);
  });
}

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "接口不存在" });
});

// 生产部署：托管前端构建产物（web/dist），未命中静态文件时回退 index.html（SPA）
const distDir = path.resolve(WEB_DIST);
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

// 统一错误处理：HttpError 带状态码；其余 500（生产不泄露内部错误细节）
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status =
    err instanceof HttpError ? err.status : (err as { status?: number }).status ?? 500;
  if (status >= 500) console.error("[error]", err);
  const message =
    status >= 500 && process.env.NODE_ENV === "production"
      ? "服务器内部错误"
      : err.message ?? "服务器内部错误";
  res.status(status).json({ error: message });
});

async function main() {
  try {
    await initDb();
    console.log(`[mysql] connected: ${dbUriSummary()}`);
  } catch (e) {
    console.error("[mysql] 连接失败（需本机 MySQL 运行，默认 root:1234@127.0.0.1:3306/plfx）", e);
    process.exit(1);
  }

  // 运行期连接事件监听：断连/重连有日志，DB 抖动不静默
  sequelize.addHook("afterConnect", () => console.log("[mysql] connection established"));
  sequelize.addHook("beforeDisconnect", () => console.warn("[mysql] disconnected"));

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[insight-server] 端口 ${PORT} 已被占用，请换 PORT 或释放端口`);
    } else {
      console.error("[insight-server] listen error:", err);
    }
    process.exit(1);
  });
  httpServer.listen(PORT, () => {
    console.log(`[insight-server] http://localhost:${PORT}（前端产物目录: ${distDir}）`);
  });

  // 恢复 server 重启前的定时抓取任务
  try {
    const feedDatasets = await DatasetModel.findAll({
      where: { feedUrl: { [Op.ne]: "" }, feedRunning: true },
    });
    for (const d of feedDatasets) {
      void startFeed(d.id).catch((e) => {
        console.error(`[feed] restore failed: ${d.name}`, e instanceof Error ? e.message : e);
      });
      console.log(`[feed] restored: ${d.name}`);
    }
  } catch (e) {
    console.error("[feed] restore error:", e instanceof Error ? e.message : e);
  }
}

main();
