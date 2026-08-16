import { Schema, model } from "mongoose";

const datasetSchema = new Schema(
  {
    name: { type: String, required: true },
    platform: { type: String, default: "混合来源" },
    type: { type: String, enum: ["builtin", "imported", "feed"], default: "imported" },
    scenarioId: { type: String, default: "" },
    // URL 定时抓取
    feedUrl: { type: String, default: "" },
    feedIntervalMin: { type: Number, default: 0 },
    feedRunning: { type: Boolean, default: false },
    feedLastAt: { type: Date, default: null },
    feedLastCount: { type: Number, default: 0 },
    feedLastError: { type: String, default: "" },
  },
  { timestamps: true }
);

const commentSchema = new Schema(
  {
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true, index: true },
    content: { type: String, required: true },
    author: { type: String, default: "匿名用户" },
    platform: { type: String, default: "未知" },
    timestamp: { type: Date, default: () => new Date(), index: true },
    sentiment: { type: String, enum: ["pos", "neu", "neg"], default: "neu" },
    sentimentScore: { type: Number, default: 0 },
    topics: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    analyzed: { type: Boolean, default: false },
    // 数据源原始 ID：仅当抓取接口提供 id 时按它去重（同一条评论不重复抓）
    sourceId: { type: String, default: "" },
  },
  { timestamps: true }
);
commentSchema.index({ datasetId: 1, timestamp: 1 });
// 抓取去重唯一索引：仅对带 sourceId 的评论生效（无 sourceId 的按内容+作者去重）
commentSchema.index(
  { datasetId: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: "string", $ne: "" } } }
);

const analysisJobSchema = new Schema(
  {
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true },
    status: { type: String, enum: ["pending", "running", "paused", "done", "failed"], default: "pending" },
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    concurrency: { type: Number, default: 4 },
  },
  { timestamps: true }
);

const alertRuleSchema = new Schema(
  {
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true },
    type: { type: String, enum: ["negativity", "volume", "keyword"], required: true },
    threshold: { type: Number, required: true },
    keyword: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const alertSchema = new Schema(
  {
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true },
    type: { type: String, enum: ["negativity", "volume", "keyword"], required: true },
    severity: { type: String, enum: ["critical", "warning", "info"], default: "warning" },
    message: { type: String, required: true },
    value: { type: Number, default: 0 },
    triggeredAt: { type: Date, default: () => new Date() },
    acknowledged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const DatasetModel = model("Dataset", datasetSchema);
export const CommentModel = model("Comment", commentSchema);
export const AnalysisJobModel = model("AnalysisJob", analysisJobSchema);
export const AlertRuleModel = model("AlertRule", alertRuleSchema);
export const AlertModel = model("Alert", alertSchema);
