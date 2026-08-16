// 前后端共享类型（舆情雷达 InsightScope）

export type Sentiment = "pos" | "neu" | "neg";

export interface CommentItem {
  datasetId: string;
  content: string;
  author: string;
  platform: string;
  timestamp: Date | string;
  sentiment: Sentiment;
  sentimentScore: number; // -1 ~ 1
  topics: string[];
  keywords: string[];
  analyzed: boolean;
}

export type JobStatus = "pending" | "running" | "paused" | "done" | "failed";

export interface AnalysisJob {
  id: string;
  datasetId: string;
  status: JobStatus;
  total: number;
  processed: number;
  failed: number;
  concurrency: number;
  createdAt: string;
  updatedAt: string;
}

export type AlertRuleType = "negativity" | "volume" | "keyword";
export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertRule {
  id: string;
  datasetId: string;
  type: AlertRuleType;
  threshold: number;
  keyword?: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  datasetId: string;
  type: AlertRuleType;
  severity: AlertSeverity;
  message: string;
  value: number;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface DatasetStats {
  total: number;
  analyzed: number;
  sentiment: { pos: number; neu: number; neg: number };
  topics: { name: string; count: number }[];
  keywords: { word: string; count: number }[];
  trend: { date: string; pos: number; neu: number; neg: number; total: number }[];
}
