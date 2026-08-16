import type { Sentiment } from "../types.js";

/** 外部传入的原始评论（数据源 / 导入数组的一项） */
export interface RawComment {
  content?: unknown;
  text?: unknown;
  comment?: unknown;
  author?: unknown;
  platform?: unknown;
  timestamp?: unknown;
  sentiment?: unknown;
  sentimentScore?: unknown;
  topics?: unknown;
  keywords?: unknown;
  analyzed?: unknown;
  id?: unknown;
  commentId?: unknown;
}

export interface NormalizedComment {
  content: string;
  author: string;
  platform: string;
  timestamp: Date;
  sentiment: Sentiment;
  sentimentScore: number;
  topics: string[];
  keywords: string[];
  analyzed: boolean;
  sourceId: string;
}

/** 把外部评论规范化为入库文档（feeds / 导入 共用同一套字段映射） */
export function normalizeComment(raw: RawComment, ctx: { platform: string; now: number; index: number }): NormalizedComment {
  const content = String(raw.content ?? raw.text ?? raw.comment ?? "").slice(0, 2000);
  const author = raw.author ? String(raw.author) : "匿名用户";
  const sourceId = raw.id ?? raw.commentId ? String(raw.id ?? raw.commentId) : "";
  const sentiment: Sentiment = ["pos", "neu", "neg"].includes(raw.sentiment as string)
    ? (raw.sentiment as Sentiment)
    : "neu";
  return {
    content,
    author,
    platform: raw.platform ? String(raw.platform) : ctx.platform,
    timestamp: raw.timestamp ? new Date(String(raw.timestamp)) : new Date(ctx.now + ctx.index * 1000),
    sentiment,
    sentimentScore: typeof raw.sentimentScore === "number" ? raw.sentimentScore : 0,
    topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
    analyzed: Boolean(raw.analyzed) || Boolean(raw.sentiment),
    sourceId,
  };
}

/**
 * 去重规则（全项目统一）：
 * - 数据源提供 id → 按 id 去重（同一条评论不重复抓）
 * - 无 id → 按「内容 + 作者」去重：同一作者重复发相同内容只留一条；不同作者相同内容保留
 * 返回可直接用于数据库查询的 filter（与 datasetId 合并使用）。
 */
export function buildDedupFilter(raw: RawComment, author: string): Record<string, string> {
  const sourceId = raw.id ?? raw.commentId;
  if (sourceId) return { sourceId: String(sourceId) };
  return { content: String(raw.content ?? raw.text ?? raw.comment ?? "").slice(0, 2000), author };
}

/** 内存去重 key（导入数组内去重用） */
export function dedupKeyOf(raw: RawComment, author: string): string {
  const sourceId = raw.id ?? raw.commentId;
  if (sourceId) return `id:${sourceId}`;
  return `ca:${author}||${String(raw.content ?? raw.text ?? raw.comment ?? "").trim()}`;
}
