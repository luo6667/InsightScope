// 一次性迁移：MongoDB(insight) → MySQL(insight)
// 运行：cd insight/server && npx tsx scripts/migrate-mongodb-to-mysql.ts [--force]
//   --force：迁移前清空 MySQL 全部表（幂等重跑用）；默认在 MySQL 已有数据时拒绝执行
// 映射说明：MongoDB ObjectId → MySQL 自增 id（datasets 先行插入并建立映射，
// comments/analysis_jobs/alert_rules/alerts 的 datasetId 引用随之转换）；
// topics/keywords 数组 → MySQL JSON 列；时间字段原样保留。
import { MongoClient } from "mongodb";
import { initDb, sequelize } from "../src/db.js";
import {
  DatasetModel,
  CommentModel,
  AnalysisJobModel,
  AlertRuleModel,
  AlertModel,
} from "../src/models.js";

const MONGO_URI =
  process.env.MONGO_URI ?? "mongodb://root:1234@127.0.0.1:27017/insight?authSource=admin";
const FORCE = process.argv.includes("--force");

const TABLES = ["alerts", "alert_rules", "analysis_jobs", "comments", "datasets"];

async function main() {
  await initDb(); // 确保 MySQL 库表存在

  const existingDatasets = await DatasetModel.count();
  if (existingDatasets > 0 && !FORCE) {
    console.error(
      `MySQL 已有 ${existingDatasets} 个数据集，拒绝迁移（防重复导入）。确认清空后重跑，或加 --force 自动清空。`
    );
    process.exit(1);
  }
  if (FORCE && existingDatasets > 0) {
    console.log("[migrate] --force：清空 MySQL 全部表…");
    for (const t of TABLES) await sequelize.query(`TRUNCATE TABLE \`${t}\``);
  }

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db("insight");

  const [datasets, comments, jobs, rules, alerts] = await Promise.all([
    db.collection("datasets").find().sort({ _id: 1 }).toArray(),
    db.collection("comments").find().sort({ _id: 1 }).toArray(),
    db.collection("analysisjobs").find().sort({ _id: 1 }).toArray(),
    db.collection("alertrules").find().sort({ _id: 1 }).toArray(),
    db.collection("alerts").find().sort({ _id: 1 }).toArray(),
  ]);

  // 1) datasets：先行插入，建立 ObjectId -> 新自增 id 映射
  const idMap = new Map<string, string>(); // 旧 ObjectId hex -> 新数据集 id
  for (const d of datasets) {
    const row = await DatasetModel.create({
      name: d.name ?? "未命名",
      platform: d.platform ?? "混合来源",
      type: d.type ?? "imported",
      scenarioId: d.scenarioId ?? "",
      feedUrl: d.feedUrl ?? "",
      feedIntervalMin: Number(d.feedIntervalMin ?? 0),
      feedRunning: Boolean(d.feedRunning),
      feedLastAt: d.feedLastAt ?? null,
      feedLastCount: Number(d.feedLastCount ?? 0),
      feedLastError: d.feedLastError ?? "",
      createdAt: d.createdAt ?? new Date(),
      updatedAt: d.updatedAt ?? new Date(),
    });
    idMap.set(String(d._id), row.id);
  }

  // datasetId 引用转换（找不到映射时保留原值，避免丢数据，计数提示）
  const mapDsId = (v: unknown): string => {
    const key = String(v ?? "");
    return idMap.get(key) ?? key;
  };
  let orphanComments = 0;

  // 2) comments
  const commentDocs = comments.map((c) => {
    const mapped = mapDsId(c.datasetId);
    if (mapped === String(c.datasetId)) orphanComments++;
    return {
      datasetId: mapped,
      content: c.content ?? "",
      author: c.author ?? "匿名用户",
      platform: c.platform ?? "未知",
      timestamp: c.timestamp ?? new Date(),
      sentiment: ["pos", "neu", "neg"].includes(c.sentiment) ? c.sentiment : "neu",
      sentimentScore: Number(c.sentimentScore ?? 0),
      topics: Array.isArray(c.topics) ? c.topics : [],
      keywords: Array.isArray(c.keywords) ? c.keywords : [],
      analyzed: Boolean(c.analyzed),
      sourceId: c.sourceId ?? "",
      createdAt: c.createdAt ?? new Date(),
      updatedAt: c.updatedAt ?? new Date(),
    };
  });
  for (let i = 0; i < commentDocs.length; i += 500) {
    await CommentModel.bulkCreate(commentDocs.slice(i, i + 500));
  }

  // 3) analysis_jobs
  const jobDocs = jobs.map((j) => ({
    datasetId: mapDsId(j.datasetId),
    status: j.status ?? "pending",
    total: Number(j.total ?? 0),
    processed: Number(j.processed ?? 0),
    failed: Number(j.failed ?? 0),
    concurrency: Number(j.concurrency ?? 4),
    createdAt: j.createdAt ?? new Date(),
    updatedAt: j.updatedAt ?? new Date(),
  }));
  if (jobDocs.length) await AnalysisJobModel.bulkCreate(jobDocs);

  // 4) alert_rules
  const ruleDocs = rules.map((r) => ({
    datasetId: mapDsId(r.datasetId),
    type: r.type ?? "negativity",
    threshold: Number(r.threshold ?? 0),
    keyword: r.keyword ?? "",
    enabled: r.enabled === undefined ? true : Boolean(r.enabled),
    createdAt: r.createdAt ?? new Date(),
    updatedAt: r.updatedAt ?? new Date(),
  }));
  if (ruleDocs.length) await AlertRuleModel.bulkCreate(ruleDocs);

  // 5) alerts
  const alertDocs = alerts.map((a) => ({
    datasetId: mapDsId(a.datasetId),
    type: a.type ?? "negativity",
    severity: a.severity ?? "warning",
    message: a.message ?? "",
    value: Number(a.value ?? 0),
    triggeredAt: a.triggeredAt ?? new Date(),
    acknowledged: Boolean(a.acknowledged),
    createdAt: a.createdAt ?? new Date(),
    updatedAt: a.updatedAt ?? new Date(),
  }));
  if (alertDocs.length) await AlertModel.bulkCreate(alertDocs);

  await mongo.close();

  // 统计输出
  const [nDs, nCm, nJobs, nRules, nAlerts] = await Promise.all([
    DatasetModel.count(),
    CommentModel.count(),
    AnalysisJobModel.count(),
    AlertRuleModel.count(),
    AlertModel.count(),
  ]);
  console.log("[migrate] 完成：");
  console.log(`  datasets:     ${datasets.length} -> MySQL ${nDs}`);
  console.log(`  comments:     ${comments.length} -> MySQL ${nCm}${orphanComments ? `（其中 ${orphanComments} 条 datasetId 无对应数据集）` : ""}`);
  console.log(`  analysisjobs: ${jobs.length} -> MySQL ${nJobs}`);
  console.log(`  alertrules:   ${rules.length} -> MySQL ${nRules}`);
  console.log(`  alerts:       ${alerts.length} -> MySQL ${nAlerts}`);
}

main().catch((e) => {
  console.error("[migrate] 失败：", e instanceof Error ? e.message : e);
  process.exit(1);
});
