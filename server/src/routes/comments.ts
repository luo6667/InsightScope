import { Router } from "express";
import { Op } from "sequelize";
import { sequelize } from "../db.js";
import { CommentModel } from "../models.js";
import { countKeywords } from "../services/textService.js";
import type { Sentiment } from "../types.js";

const router = Router();

/** MySQL LIKE 转义：% _ \（保证与原先正则字面量搜索行为一致） */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function timeFilter(req: { query: Record<string, unknown> }): { timestamp?: { [Op.gte]?: Date; [Op.lte]?: Date } } {
  const f: { timestamp?: { [Op.gte]?: Date; [Op.lte]?: Date } } = {};
  if (req.query.from) f.timestamp = { ...f.timestamp, [Op.gte]: new Date(String(req.query.from)) };
  if (req.query.to) f.timestamp = { ...f.timestamp, [Op.lte]: new Date(String(req.query.to)) };
  // 注意：不能再用 Object.keys(...).length 判断——Op.gte/Op.lte 是 symbol 键，Object.keys 数不到
  return f.timestamp ? f : {};
}

/** 构造评论列表共用过滤条件（datasetId + 时间 + 情感 + 主题 + 关键词搜索） */
function buildFilter(req: { query: Record<string, unknown> }, datasetId: string): Record<string, unknown> {
  const filter: Record<PropertyKey, unknown> = { datasetId, ...timeFilter(req) };
  if (req.query.sentiment) filter.sentiment = req.query.sentiment;
  if (req.query.topic) {
    // topics 为 JSON 数组列：JSON_CONTAINS 判断是否包含该主题（等价于原先 Mongo 数组包含语义）
    filter[Op.and] = sequelize.where(
      sequelize.fn("JSON_CONTAINS", sequelize.col("topics"), sequelize.fn("JSON_QUOTE", String(req.query.topic))),
      1
    );
  }
  if (req.query.q) {
    const q = String(req.query.q);
    if (q.length > 200) return { __qTooLong: true } as unknown as Record<string, unknown>;
    // 不区分大小写：utf8mb4_unicode_ci 排序规则下 LIKE 天然忽略大小写
    filter.content = { [Op.like]: `%${escapeLike(q)}%` };
  }
  return filter as Record<string, unknown>;
}

// 评论分页列表：GET /:datasetId/comments?page=&limit=&sentiment=&topic=&q=&from=&to=
router.get("/:datasetId/comments", async (req, res) => {
  try {
    const rawPage = Number(req.query.page ?? 1);
    const rawLimit = Number(req.query.limit ?? 20);
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
    const filter = buildFilter(req, req.params.datasetId);
    if ((filter as { __qTooLong?: boolean }).__qTooLong) {
      return res.status(400).json({ error: "搜索词过长（最多 200 字符）" });
    }
    const { count: total, rows } = await CommentModel.findAndCountAll({
      where: filter,
      order: [["timestamp", "DESC"]],
      offset: (page - 1) * limit,
      limit,
      raw: true,
    });
    res.json({
      total,
      page,
      limit,
      comments: rows.map((c) => ({
        id: c.id,
        content: c.content,
        author: c.author,
        platform: c.platform,
        timestamp: c.timestamp,
        sentiment: c.sentiment,
        sentimentScore: c.sentimentScore,
        topics: c.topics,
        keywords: c.keywords,
        analyzed: c.analyzed,
      })),
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 手动修正评论：PATCH /:datasetId/comments/:cid  { sentiment?, topics?, sentimentScore? }
router.patch("/:datasetId/comments/:cid", async (req, res) => {
  try {
    const { sentiment, topics, sentimentScore } = req.body ?? {};
    const set: Record<string, unknown> = {};
    if (sentiment && ["pos", "neu", "neg"].includes(sentiment as string)) {
      set.sentiment = sentiment as Sentiment;
      const score =
        typeof sentimentScore === "number" && Number.isFinite(sentimentScore)
          ? Math.max(-1, Math.min(1, sentimentScore))
          : sentiment === "pos" ? 0.8 : sentiment === "neg" ? -0.8 : 0;
      set.sentimentScore = Math.round(score * 100) / 100;
    }
    if (Array.isArray(topics)) set.topics = topics.map(String).slice(0, 5);
    if (Object.keys(set).length === 0) return res.status(400).json({ error: "没有可更新的字段" });
    set.analyzed = true;
    const [affected] = await CommentModel.update(set, {
      where: { id: req.params.cid, datasetId: req.params.datasetId },
    });
    if (affected === 0) return res.status(404).json({ error: "评论不存在" });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 导出评论：GET /:datasetId/export?format=csv|json&sentiment=&topic=&q=&from=&to=
router.get("/:datasetId/export", async (req, res) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "json";
    const filter = buildFilter(req, req.params.datasetId);
    if ((filter as { __qTooLong?: boolean }).__qTooLong) {
      return res.status(400).json({ error: "搜索词过长（最多 200 字符）" });
    }
    const rows = await CommentModel.findAll({
      where: filter,
      order: [["timestamp", "DESC"]],
      limit: 5000,
      raw: true,
    });

    if (format === "csv") {
      const header = ["content", "author", "platform", "timestamp", "sentiment", "topics"];
      // 防 CSV 公式注入：以 = + - @ 开头的单元格加前缀单引号
      const escape = (v: unknown) => {
        const s = String(v ?? "");
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const lines = [header.join(",")];
      for (const c of rows) {
        lines.push(
          [c.content, c.author, c.platform, c.timestamp ? new Date(c.timestamp).toISOString() : "", c.sentiment, (c.topics ?? []).join("|")]
            .map(escape)
            .join(",")
        );
      }
      res.setHeader("Content-Type", "text/csv;charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=comments-${req.params.datasetId}.csv`);
      res.send("\uFEFF" + lines.join("\r\n"));
      return;
    }
    res.json({
      comments: rows.map((c) => ({
        id: c.id,
        content: c.content,
        author: c.author,
        platform: c.platform,
        timestamp: c.timestamp,
        sentiment: c.sentiment,
        sentimentScore: c.sentimentScore,
        topics: c.topics,
      })),
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 聚合统计：GET /:datasetId/stats?from=&to=（支持时间过滤，供时段对比）
router.get("/:datasetId/stats", async (req, res) => {
  const id = req.params.datasetId;
  try {
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "数据集 ID 不合法" });
    const tf = timeFilter(req);
    const where: Record<string, unknown> = { datasetId: id, ...tf };
    const [total, analyzed, rows] = await Promise.all([
      CommentModel.count({ where: { datasetId: id, ...tf } }),
      CommentModel.count({ where: { datasetId: id, ...tf, analyzed: true } }),
      // 单次拉取所需字段，内存聚合情感/主题/趋势（单数据集量级小，行为与原先聚合管道一致）
      CommentModel.findAll({
        where,
        attributes: ["sentiment", "topics", "timestamp"],
        raw: true,
      }),
    ]);

    const sentiment = { pos: 0, neu: 0, neg: 0 };
    const topicCount = new Map<string, number>();
    const trendMap = new Map<string, { date: string; pos: number; neu: number; neg: number; total: number }>();
    for (const r of rows) {
      const s = r.sentiment as "pos" | "neu" | "neg";
      if (s in sentiment) sentiment[s]++;
      for (const t of r.topics ?? []) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
      // 趋势按 UTC 日期分组（与原 $dateToString 默认 UTC 行为一致）
      const date = new Date(r.timestamp).toISOString().slice(0, 10);
      const row = trendMap.get(date) ?? { date, pos: 0, neu: 0, neg: 0, total: 0 };
      if (s in row) row[s]++;
      row.total++;
      trendMap.set(date, row);
    }

    const topics = [...topicCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
    const trend = [...trendMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

    // 关键词云：从评论内容按评价词典统计词频（支持 ?dictionary= 自定义词，逗号分隔）
    const customDict = req.query.dictionary
      ? String(req.query.dictionary).split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const contentRows = await CommentModel.findAll({
      where: { datasetId: id, ...tf },
      attributes: ["content"],
      order: [["timestamp", "DESC"]],
      limit: 1000,
      raw: true,
    });
    const keywords = countKeywords(contentRows.map((c) => c.content), 20, customDict);

    res.json({
      total,
      analyzed,
      sentiment,
      topics,
      keywords,
      trend,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
