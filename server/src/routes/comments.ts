import { Router } from "express";
import { Types } from "mongoose";
import { CommentModel } from "../models.js";
import { countKeywords } from "../services/textService.js";
import type { Sentiment } from "../types.js";

const router = Router();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function timeFilter(req: { query: Record<string, unknown> }): { timestamp?: { $gte?: Date; $lte?: Date } } {
  const f: { timestamp?: { $gte?: Date; $lte?: Date } } = {};
  if (req.query.from) f.timestamp = { ...f.timestamp, $gte: new Date(String(req.query.from)) };
  if (req.query.to) f.timestamp = { ...f.timestamp, $lte: new Date(String(req.query.to)) };
  return Object.keys(f.timestamp ?? {}).length ? f : {};
}

// 评论分页列表：GET /:datasetId/comments?page=&limit=&sentiment=&topic=&q=&from=&to=
router.get("/:datasetId/comments", async (req, res) => {
  try {
    const rawPage = Number(req.query.page ?? 1);
    const rawLimit = Number(req.query.limit ?? 20);
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
    const filter: Record<string, unknown> = { datasetId: req.params.datasetId, ...timeFilter(req) };
    if (req.query.sentiment) filter.sentiment = req.query.sentiment;
    if (req.query.topic) filter.topics = req.query.topic as string;
    if (req.query.q) {
      const q = String(req.query.q);
      if (q.length > 200) return res.status(400).json({ error: "搜索词过长（最多 200 字符）" });
      filter.content = { $regex: escapeRegExp(q), $options: "i" };
    }
    const [total, rows] = await Promise.all([
      CommentModel.countDocuments(filter),
      CommentModel.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    res.json({
      total,
      page,
      limit,
      comments: rows.map((c) => ({
        id: c._id,
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
    const r = await CommentModel.updateOne(
      { _id: req.params.cid, datasetId: req.params.datasetId },
      { $set: set }
    );
    if (r.matchedCount === 0) return res.status(404).json({ error: "评论不存在" });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 导出评论：GET /:datasetId/export?format=csv|json&sentiment=&topic=&q=&from=&to=
router.get("/:datasetId/export", async (req, res) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "json";
    const filter: Record<string, unknown> = { datasetId: req.params.datasetId, ...timeFilter(req) };
    if (req.query.sentiment) filter.sentiment = req.query.sentiment;
    if (req.query.topic) filter.topics = req.query.topic as string;
    if (req.query.q) {
      const q = String(req.query.q);
      if (q.length > 200) return res.status(400).json({ error: "搜索词过长（最多 200 字符）" });
      filter.content = { $regex: escapeRegExp(q), $options: "i" };
    }
    const rows = await CommentModel.find(filter)
      .sort({ timestamp: -1 })
      .limit(5000)
      .lean();

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
          [c.content, c.author, c.platform, c.timestamp?.toISOString?.() ?? "", c.sentiment, (c.topics ?? []).join("|")]
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
        id: c._id,
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
    let oid: Types.ObjectId;
    try {
      oid = new Types.ObjectId(id);
    } catch {
      return res.status(400).json({ error: "数据集 ID 不合法" });
    }
    const tf = timeFilter(req);
    const match: Record<string, unknown> = { datasetId: oid, ...tf };
    const [total, analyzed] = await Promise.all([
      CommentModel.countDocuments({ datasetId: id, ...tf }),
      CommentModel.countDocuments({ datasetId: id, ...tf, analyzed: true }),
    ]);

    const sentimentRows = await CommentModel.aggregate([
      { $match: match },
      { $group: { _id: "$sentiment", count: { $sum: 1 } } },
    ]);
    const sentiment = { pos: 0, neu: 0, neg: 0 };
    for (const r of sentimentRows) sentiment[r._id as "pos" | "neu" | "neg"] = r.count;

    const topics = await CommentModel.aggregate([
      { $match: { ...match, topics: { $ne: [] } } },
      { $unwind: "$topics" },
      { $group: { _id: "$topics", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);

    // 关键词云：从评论内容按评价词典统计词频（支持 ?dictionary= 自定义词，逗号分隔）
    const customDict = req.query.dictionary
      ? String(req.query.dictionary).split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const contentRows = await CommentModel.find({ datasetId: id, ...tf })
      .sort({ timestamp: -1 })
      .limit(1000)
      .select("content")
      .lean();
    const keywords = countKeywords(contentRows.map((c) => c.content), 20, customDict);

    const trendRows = await CommentModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, s: "$sentiment" },
          n: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);
    const trendMap = new Map<string, { date: string; pos: number; neu: number; neg: number; total: number }>();
    for (const r of trendRows) {
      const date = r._id.date as string;
      const s = r._id.s as "pos" | "neu" | "neg";
      const row = trendMap.get(date) ?? { date, pos: 0, neu: 0, neg: 0, total: 0 };
      row[s] = r.n;
      row.total += r.n;
      trendMap.set(date, row);
    }
    const trend = [...trendMap.values()];

    res.json({
      total,
      analyzed,
      sentiment,
      topics: topics.map((t) => ({ name: t._id, count: t.count })),
      keywords,
      trend,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
