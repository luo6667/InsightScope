import { Router } from "express";
import { DatasetModel, CommentModel, AnalysisJobModel, AlertModel, AlertRuleModel } from "../models.js";
import { generateScenarioComments, getScenario } from "../services/scenarioService.js";
import { startFeed, stopFeed } from "./feeds.js";
import { cancelJobsForDataset } from "./analysis.js";
import { normalizeComment, dedupKeyOf } from "../utils/commentUtils.js";
import { assertPublicHttpUrl } from "../utils/urlSafety.js";

const router = Router();

// 数据集列表（含统计）
router.get("/", async (_req, res) => {
  try {
    const datasets = await DatasetModel.find().sort({ createdAt: -1 }).lean();
    const rows = await Promise.all(
      datasets.map(async (d) => {
        const [cnt, analyzed] = await Promise.all([
          CommentModel.countDocuments({ datasetId: d._id }),
          CommentModel.countDocuments({ datasetId: d._id, analyzed: true }),
        ]);
        return {
          id: d._id,
          name: d.name,
          platform: d.platform,
          type: d.type,
          scenarioId: d.scenarioId,
          feedUrl: d.feedUrl ?? "",
          feedIntervalMin: d.feedIntervalMin ?? 0,
          feedRunning: d.feedRunning ?? false,
          feedLastAt: d.feedLastAt ?? null,
          feedLastCount: d.feedLastCount ?? 0,
          feedLastError: d.feedLastError ?? "",
          commentCount: cnt,
          analyzedCount: analyzed,
          createdAt: d.createdAt,
        };
      })
    );
    res.json({ datasets: rows });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 数据集详情
router.get("/:id", async (req, res) => {
  try {
    const d = await DatasetModel.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: "数据集不存在" });
    const [commentCount, analyzedCount] = await Promise.all([
      CommentModel.countDocuments({ datasetId: d._id }),
      CommentModel.countDocuments({ datasetId: d._id, analyzed: true }),
    ]);
    res.json({
      id: d._id,
      name: d.name,
      platform: d.platform,
      type: d.type,
      scenarioId: d.scenarioId,
      commentCount,
      analyzedCount,
      createdAt: d.createdAt,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 创建数据集：{ name?, scenarioId } 内置场景 | { name?, platform?, comments } 导入 | { name?, feedUrl, feedIntervalMin } 定时抓取
router.post("/", async (req, res) => {
  const { name, scenarioId, platform, comments, feedUrl, feedIntervalMin } = req.body ?? {};
  try {
    if (scenarioId) {
      const def = getScenario(scenarioId);
      if (!def) return res.status(400).json({ error: "场景不存在" });
      const dataset = await DatasetModel.create({
        name: name?.trim() || def.name,
        platform: platform || "混合来源",
        type: "builtin",
        scenarioId,
      });
      const generated = generateScenarioComments(def);
      await CommentModel.insertMany(
        generated.map((g) => ({
          datasetId: dataset._id,
          content: g.content,
          author: g.author,
          platform: g.platform,
          timestamp: g.timestamp,
          sentiment: g.sentiment,
          sentimentScore: g.sentimentScore,
          topics: g.topics,
          keywords: g.keywords,
          analyzed: true, // 内置场景已预标注，无 key 也能完整演示
        }))
      );
      return res.status(201).json({ id: dataset._id, count: generated.length });
    }

    if (Array.isArray(comments) && comments.length > 0) {
      const dataset = await DatasetModel.create({
        name: name?.trim() || `导入数据 ${new Date().toLocaleDateString("zh-CN")}`,
        platform: platform || "导入来源",
        type: "imported",
      });
      const now = Date.now();
      // 去重规则（全项目统一）：同一作者发相同内容只留一条；不同作者发相同内容都保留
      const seen = new Set<string>();
      let i = 0;
      const docs = comments
        .filter((c) => {
          const author = c.author ? String(c.author) : "匿名用户";
          const key = dedupKeyOf(c as never, author);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => {
          const doc = normalizeComment(c as never, { platform: platform || "导入来源", now, index: i });
          i++;
          return { datasetId: dataset._id, ...doc };
        });
      await CommentModel.insertMany(docs);
      return res.status(201).json({ id: dataset._id, count: docs.length, deduped: comments.length - docs.length });
    }

    // URL 定时抓取数据集
    if (typeof feedUrl === "string" && feedUrl.trim()) {
      // SSRF 防护：绝对 URL 必须为公网地址；相对路径（如 /api/demo/feed）仅指向后端自身
      const trimmed = feedUrl.trim();
      if (!trimmed.startsWith("/")) {
        assertPublicHttpUrl(trimmed, "feedUrl");
      }
      const dataset = await DatasetModel.create({
        name: name?.trim() || `定时抓取 ${new Date().toLocaleDateString("zh-CN")}`,
        platform: platform || "数据源",
        type: "feed",
        feedUrl: trimmed,
        feedIntervalMin: Math.max(1, Number(feedIntervalMin ?? 5)),
        feedRunning: true,
      });
      await startFeed(String(dataset._id)); // 立即抓一次 + 定时
      return res.status(201).json({ id: dataset._id, count: 0, feed: true });
    }

    res.status(400).json({ error: "需要 scenarioId / comments 数组 / feedUrl" });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// 删除数据集（级联清理）
router.delete("/:id", async (req, res) => {
  try {
    const d = await DatasetModel.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: "数据集不存在" });
    stopFeed(String(d._id));
    await cancelJobsForDataset(String(d._id)); // 取消运行中的分析任务，防止旧 worker 继续写已删除数据
    await Promise.all([
      CommentModel.deleteMany({ datasetId: d._id }),
      AnalysisJobModel.deleteMany({ datasetId: d._id }),
      AlertModel.deleteMany({ datasetId: d._id }),
      AlertRuleModel.deleteMany({ datasetId: d._id }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;
