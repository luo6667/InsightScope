import { Router } from "express";
import { Types } from "mongoose";
import { AlertModel, AlertRuleModel, CommentModel } from "../models.js";
import { io } from "../index.js";
import { detectAnomaly } from "../services/anomalyService.js";

const router = Router();

// 模拟器状态：dataset -> { timer, index, speed }
const sims = new Map<string, { timer: ReturnType<typeof setTimeout> | null; index: number; speed: number }>();

const WINDOW = 20; // 告警检测窗口（最近 N 条）
const COOLDOWN_MS = 60_000; // 同规则冷却

function emit(datasetId: string, event: string, payload: unknown) {
  io.to(`dataset:${datasetId}`).emit(event, payload);
}

/**
 * 触发告警检测：负面率 Z-score 异常 + 规则阈值 + 关键词。
 * cutoff：模拟器重放时只检测"已流入"的评论（timestamp <= cutoff），保证演示时序正确。
 */
async function checkAlerts(datasetId: string, cutoff?: Date) {
  const rules = await AlertRuleModel.find({ datasetId, enabled: true }).lean();
  if (rules.length === 0) return;

  const timeFilter = cutoff ? { $lte: cutoff } : undefined;
  const recent = await CommentModel.find({ datasetId, ...(timeFilter ? { timestamp: timeFilter } : {}) })
    .sort({ timestamp: -1 })
    .limit(WINDOW)
    .lean();
  if (recent.length < 5) return;

  const negRate = recent.filter((c) => c.sentiment === "neg").length / recent.length;

  // Z-score：滑动窗口负面率序列（每 5 条采样）检测突增（只统计已流入的评论）
  let anomalyMsg: string | null = null;
  try {
    const oid = new Types.ObjectId(datasetId);
    const grouped = await CommentModel.aggregate([
      { $match: { datasetId: oid, ...(timeFilter ? { timestamp: timeFilter } : {}) } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: null, items: { $push: { s: "$sentiment" } } } },
    ]);
    const items = grouped[0]?.items ?? [];
    const seq: number[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const slice = items.slice(Math.max(0, i - WINDOW), i + 1);
      seq.push(slice.filter((x: { s: string }) => x.s === "neg").length / slice.length);
    }
    const sampled: number[] = [];
    for (let i = 0; i < seq.length; i += 5) sampled.push(Math.round(seq[i] * 100) / 100);
    const res = detectAnomaly(sampled, 2);
    if (res?.isAnomaly && res.current > res.mean) {
      anomalyMsg = `负面率异常突增：当前 ${Math.round(res.current * 100)}%，基线 ${Math.round(res.mean * 100)}%（Z=${res.zScore.toFixed(1)}）`;
    }
  } catch {
    /* Z-score 失败不影响规则检测 */
  }

  const triggers: { type: string; severity: "critical" | "warning" | "info"; message: string; value: number }[] = [];

  // 冷却检查：同一数据集 + 类型最近 60s 是否已触发
  const inCooldown = async (type: string) => {
    const recentAlert = await AlertModel.findOne({
      datasetId,
      type,
      triggeredAt: { $gte: new Date(Date.now() - COOLDOWN_MS) },
    }).lean();
    return !!recentAlert;
  };

  if (anomalyMsg && !(await inCooldown("negativity"))) {
    triggers.push({ type: "negativity", severity: "critical", message: anomalyMsg, value: Math.round(negRate * 100) });
  }

  for (const rule of rules) {
    if (await inCooldown(rule.type)) continue;

    if (rule.type === "negativity" && negRate >= rule.threshold / 100) {
      triggers.push({
        type: "negativity",
        severity: "warning",
        message: `负面率超过阈值 ${rule.threshold}%：当前 ${Math.round(negRate * 100)}%`,
        value: Math.round(negRate * 100),
      });
    } else if (rule.type === "keyword" && rule.keyword) {
      const hit = recent.find((c) => c.content.includes(rule.keyword));
      if (hit) {
        triggers.push({
          type: "keyword",
          severity: "info",
          message: `检测到敏感关键词「${rule.keyword}」：${hit.content.slice(0, 40)}…`,
          value: 1,
        });
      }
    } else if (rule.type === "volume" && recent.length >= rule.threshold) {
      triggers.push({
        type: "volume",
        severity: "warning",
        message: `窗口内评论量达到 ${recent.length}（阈值 ${rule.threshold}）`,
        value: recent.length,
      });
    }
  }

  for (const t of triggers) {
    const alert = await AlertModel.create({
      datasetId,
      type: t.type,
      severity: t.severity,
      message: t.message,
      value: t.value,
    });
    emit(datasetId, "alert:new", {
      id: String(alert._id),
      datasetId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      value: alert.value,
      triggeredAt: alert.triggeredAt,
      acknowledged: false,
    });
  }
}

async function tick(datasetId: string) {
  const sim = sims.get(datasetId);
  if (!sim) return;
  const total = await CommentModel.countDocuments({ datasetId });
  if (sims.get(datasetId) !== sim) return; // 期间被 stop/restart，丢弃旧链
  if (sim.index >= total) {
    stopSim(datasetId);
    return;
  }
  const comment = await CommentModel.findOne({ datasetId }).sort({ timestamp: 1 }).skip(sim.index).lean();
  if (sims.get(datasetId) !== sim) return;
  if (!comment) {
    stopSim(datasetId);
    return;
  }
  sim.index++;
  emit(datasetId, "comment:stream", {
    id: String(comment._id),
    content: comment.content,
    author: comment.author,
    platform: comment.platform,
    timestamp: comment.timestamp,
    sentiment: comment.sentiment,
    sentimentScore: comment.sentimentScore,
    topics: comment.topics,
  });
  await checkAlerts(datasetId, comment.timestamp).catch((e) => {
    console.error("[simulate] checkAlerts failed", e instanceof Error ? e.message : e);
  });
  if (sims.get(datasetId) !== sim) return; // 竞态关键：checkAlerts 期间被 restart，旧链丢弃
  // 延迟下限 30ms：speed 20 → 50ms/条 ≈ 20 条/秒
  sim.timer = setTimeout(
    () =>
      void tick(datasetId).catch((e) => {
        console.error("[simulate] tick failed", e instanceof Error ? e.message : e);
      }),
    Math.max(30, Math.round(1000 / sim.speed))
  );
}

export function stopSim(datasetId: string) {
  const sim = sims.get(datasetId);
  if (sim?.timer) clearTimeout(sim.timer);
  sims.delete(datasetId);
  emit(datasetId, "sim:status", { running: false });
}

// 开始模拟：POST /:datasetId/simulate/start { speed }
router.post("/:datasetId/simulate/start", async (req, res) => {
  const datasetId = req.params.datasetId;
  const rawSpeed = Number(req.body?.speed ?? 5);
  const speed = Number.isFinite(rawSpeed) ? Math.max(1, Math.min(20, rawSpeed)) : 5;
  const count = await CommentModel.countDocuments({ datasetId });
  if (!count) return res.status(400).json({ error: "数据集没有评论" });
  stopSim(datasetId);
  sims.set(datasetId, { timer: null, index: 0, speed });
  emit(datasetId, "sim:status", { running: true, speed, total: count });
  void tick(datasetId).catch((e) => {
    console.error("[simulate] start tick failed", e instanceof Error ? e.message : e);
  });
  res.json({ ok: true, total: count, speed });
});

// 停止模拟：POST /:datasetId/simulate/stop
router.post("/:datasetId/simulate/stop", (req, res) => {
  stopSim(req.params.datasetId);
  res.json({ ok: true });
});

// 播放中调整倍速：POST /:datasetId/simulate/speed { speed }
router.post("/:datasetId/simulate/speed", (req, res) => {
  const sim = sims.get(req.params.datasetId);
  if (!sim) return res.status(404).json({ error: "模拟未在运行" });
  const rawSpeed = Number(req.body?.speed ?? 5);
  sim.speed = Number.isFinite(rawSpeed) ? Math.max(1, Math.min(20, rawSpeed)) : 5;
  res.json({ ok: true, speed: sim.speed });
});

export default router;
