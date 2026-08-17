import { Router, type RequestHandler } from "express";
import { CommentModel, DatasetModel } from "../models.js";
import { io } from "../index.js";
import { normalizeComment, buildDedupFilter } from "../utils/commentUtils.js";
import { assertPublicHttpUrl } from "../utils/urlSafety.js";

const router = Router();

// 定时器注册表：datasetId -> { timer, running }
const feedTimers = new Map<string, { timer: ReturnType<typeof setInterval> | null }>();
// 抓取锁：同一数据集同时只允许一个抓取在跑，避免并发竞态导致去重失效
const feedLocks = new Set<string>();

function emit(datasetId: string, event: string, payload: unknown) {
  io.to(`dataset:${datasetId}`).emit(event, payload);
}

/** 抓取一次数据源（带锁，防并发） */
async function fetchFeed(datasetId: string): Promise<number> {
  if (feedLocks.has(datasetId)) return 0;
  feedLocks.add(datasetId);
  try {
    return await doFetchFeed(datasetId);
  } finally {
    feedLocks.delete(datasetId);
  }
}

async function doFetchFeed(datasetId: string): Promise<number> {
  const ds = await DatasetModel.findByPk(datasetId);
  if (!ds || !ds.feedUrl) return 0;

  // 兼容相对路径（如 /api/demo/feed）：补全为后端自身地址
  const raw = ds.feedUrl.trim();
  let url: string;
  if (raw.startsWith("/")) {
    url = `http://127.0.0.1:${Number(process.env.PORT ?? 5176)}${raw}`;
  } else {
    // SSRF 防护：绝对 URL 必须为公网地址（防御 DB 中已存在的旧数据）
    url = assertPublicHttpUrl(raw, "feedUrl");
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`数据源返回 ${res.status}`);
    const text = await res.text();
    let arr: unknown[] = [];
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) arr = parsed;
      else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { comments?: unknown[] }).comments)) {
        arr = (parsed as { comments: unknown[] }).comments;
      } else {
        throw new Error("数据格式不是数组");
      }
    } catch {
      throw new Error("数据源不是合法 JSON 数组（或 { comments: [...] }）");
    }

    // 去重规则（全项目统一）：带 id 按 id；无 id 按「内容+作者」——同作者重复发相同内容不累积，不同作者相同内容保留
    const now = Date.now();
    let inserted = 0;
    for (const item of arr.slice(0, 200)) {
      const raw = item as Record<string, unknown>;
      const author = raw.author ? String(raw.author) : "匿名用户";
      const dup = await CommentModel.findOne({
        where: { datasetId, ...buildDedupFilter(raw, author) },
        attributes: ["id"],
      });
      if (dup) continue;
      const doc = normalizeComment(raw, { platform: ds.platform || "数据源", now, index: inserted });
      const comment = await CommentModel.create({ datasetId, ...doc });
      inserted++;
      emit(datasetId, "comment:stream", {
        id: String(comment.id),
        content: comment.content,
        author: comment.author,
        platform: comment.platform,
        timestamp: comment.timestamp,
        sentiment: comment.sentiment,
        sentimentScore: comment.sentimentScore,
        topics: comment.topics,
      });
    }

    await DatasetModel.update(
      { feedLastAt: new Date(), feedLastCount: inserted, feedLastError: "" },
      { where: { id: datasetId } }
    );
    emit(datasetId, "feed:status", { running: true, lastAt: new Date(), count: inserted });
    return inserted;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await DatasetModel.update({ feedLastError: msg }, { where: { id: datasetId } }).catch(() => {});
    throw new Error(msg);
  }
}

/** 启动定时抓取（先抓一次，再按间隔循环） */
export async function startFeed(datasetId: string) {
  stopFeed(datasetId);
  const ds = await DatasetModel.findByPk(datasetId);
  if (!ds || !ds.feedUrl) return;
  const intervalMs = Math.max(1, ds.feedIntervalMin || 5) * 60 * 1000;
  await DatasetModel.update({ feedRunning: true }, { where: { id: datasetId } });
  emit(String(datasetId), "feed:status", { running: true });
  const run = async () => {
    try {
      await fetchFeed(datasetId);
    } catch (e) {
      emit(String(datasetId), "feed:error", { message: e instanceof Error ? e.message : String(e) });
    }
  };
  void run(); // 立即抓一次
  const timer = setInterval(() => void run(), intervalMs);
  feedTimers.set(datasetId, { timer });
}

export function stopFeed(datasetId: string) {
  const reg = feedTimers.get(datasetId);
  if (reg?.timer) clearInterval(reg.timer);
  feedTimers.delete(datasetId);
  void DatasetModel.update({ feedRunning: false }, { where: { id: datasetId } }).catch(() => {});
}

// 创建 feed 数据集：POST /api/datasets 已支持（feedUrl + feedIntervalMin）由 datasets 路由处理；
// 这里提供启动/停止/状态

// 启动：POST /:id/feed/start
router.post("/:datasetId/feed/start", async (req, res) => {
  const ds = await DatasetModel.findByPk(req.params.datasetId);
  if (!ds) return res.status(404).json({ error: "数据集不存在" });
  if (!ds.feedUrl) return res.status(400).json({ error: "该数据集未配置数据源 URL" });
  await startFeed(ds.id);
  res.json({ ok: true });
});

// 停止：POST /:id/feed/stop
router.post("/:datasetId/feed/stop", (req, res) => {
  stopFeed(req.params.datasetId);
  res.json({ ok: true });
});

// 立即抓取一次：POST /:id/feed/pull
router.post("/:datasetId/feed/pull", async (req, res) => {
  try {
    const count = await fetchFeed(req.params.datasetId);
    res.json({ ok: true, count });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 本地演示数据源：GET /api/demo/feed（每次返回不同评论，便于演示持续抓取 + 去重）
const DEMO_POOL: { pos: string[]; neu: string[]; neg: string[] } = {
  pos: ["新版本用起来很顺手，给个好评", "客服响应很及时，问题马上解决了", "功能越来越完善，推荐", "物流很快，第二天就到了", "质量超出预期，会回购"],
  neu: ["一般般吧，没什么特别的", "观望中，等后续版本看看", "中规中矩，能用", "包装有点简陋，其他还好"],
  neg: ["等待时间太久了，体验很差", "质量有问题，联系客服半天没人理", "更新后反而卡顿了，后悔升级", "货不对板，和描述不符", "售后流程太繁琐，浪费时间"],
};
const DEMO_AUTHORS = ["青柠", "小鹿", "Nova", "老白", "阿茶", "格子衫"];
// 挂载到 /api 下（index.ts 注册）
export const demoFeedHandler: RequestHandler = (_req, res) => {
  const n = 3 + Math.floor(Math.random() * 3);
  const comments = Array.from({ length: n }, () => {
    const roll = Math.random();
    const sentiment = roll < 0.4 ? "pos" : roll < 0.65 ? "neu" : "neg";
    const content = DEMO_POOL[sentiment][Math.floor(Math.random() * DEMO_POOL[sentiment].length)];
    return {
      content,
      author: DEMO_AUTHORS[Math.floor(Math.random() * DEMO_AUTHORS.length)],
      platform: "演示数据源",
      sentiment,
      timestamp: new Date().toISOString(),
    };
  });
  res.json({ comments });
};

export default router;
