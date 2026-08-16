import { get, post, del, patch } from "./client";
import type { Alert, AlertRule, AnalysisJob, CommentRow, DatasetInfo, DatasetStats, ScenarioInfo } from "./types";

// 数据集
export const listDatasets = () => get<{ datasets: DatasetInfo[] }>("/datasets").then((r) => r.datasets);
export const createScenarioDataset = (scenarioId: string, name?: string) =>
  post<{ id: string; count: number }>("/datasets", { scenarioId, name });
export const importComments = (comments: unknown[], name?: string, platform?: string) =>
  post<{ id: string; count: number }>("/datasets", { comments, name, platform });
export const deleteDataset = (id: string) => del<{ ok: boolean }>(`/datasets/${id}`);

// URL 定时抓取
export const createFeedDataset = (name: string, feedUrl: string, feedIntervalMin: number) =>
  post<{ id: string; count: number }>("/datasets", { name, feedUrl, feedIntervalMin });
export const startFeedPull = (id: string) => post<{ ok: boolean }>(`/datasets/${id}/feed/start`);
export const stopFeedPull = (id: string) => post<{ ok: boolean }>(`/datasets/${id}/feed/stop`);
export const pullFeedNow = (id: string) => post<{ ok: boolean; count: number }>(`/datasets/${id}/feed/pull`);

// 评论与统计
export const listComments = (datasetId: string, params?: Record<string, unknown>) =>
  get<{ total: number; page: number; limit: number; comments: CommentRow[] }>(
    `/datasets/${datasetId}/comments`,
    params
  );
export const getStats = (datasetId: string, params?: Record<string, unknown>) =>
  get<DatasetStats>(`/datasets/${datasetId}/stats`, params);

// 手动修正评论
export const updateComment = (datasetId: string, cid: string, body: { sentiment?: string; topics?: string[]; sentimentScore?: number }) =>
  patch<{ ok: boolean }>(`/datasets/${datasetId}/comments/${cid}`, body);

// 导出（返回 blob）
export function exportComments(datasetId: string, format: "csv" | "json"): void {
  const a = document.createElement("a");
  a.href = `/api/datasets/${datasetId}/export?format=${format}`;
  a.download = `comments-${datasetId}.${format}`;
  a.click();
}

// 场景
export const listScenarios = () => get<{ scenarios: ScenarioInfo[] }>("/scenarios").then((r) => r.scenarios);

// 分析任务
export const startAnalysis = (datasetId: string, cfg: { apiKey: string; baseUrl: string; model: string; temperature: number; concurrency?: number }) =>
  post<{ job: AnalysisJob }>(`/datasets/${datasetId}/analysis`, cfg).then((r) => r.job);
export const getJob = (datasetId: string) =>
  get<{ job: AnalysisJob | null }>(`/datasets/${datasetId}/analysis`).then((r) => r.job);
export const pauseAnalysis = (datasetId: string) => post(`/datasets/${datasetId}/analysis/pause`);
export const resumeAnalysis = (datasetId: string) => post(`/datasets/${datasetId}/analysis/resume`);
export const cancelAnalysis = (datasetId: string) => post(`/datasets/${datasetId}/analysis/cancel`);
export const resetAnalysis = (datasetId: string) =>
  post<{ ok: boolean; reset: number }>(`/datasets/${datasetId}/analysis/reset`);

// 实时模拟器
export const startSimulate = (datasetId: string, speed?: number) =>
  post<{ ok: boolean; total: number; speed: number }>(`/datasets/${datasetId}/simulate/start`, { speed });
export const stopSimulate = (datasetId: string) => post<{ ok: boolean }>(`/datasets/${datasetId}/simulate/stop`);
export const setSimSpeed = (datasetId: string, speed: number) =>
  post<{ ok: boolean; speed: number }>(`/datasets/${datasetId}/simulate/speed`, { speed });

// 告警
export const listRules = (datasetId?: string) =>
  get<{ rules: AlertRule[] }>("/alerts/rules", { datasetId }).then((r) => r.rules);
export const createRule = (body: { datasetId: string; type: string; threshold: number; keyword?: string }) =>
  post<{ id: string }>("/alerts/rules", body);
export const updateRule = (id: string, body: Partial<AlertRule>) => patch<{ ok: boolean }>(`/alerts/rules/${id}`, body);
export const deleteRule = (id: string) => del<{ ok: boolean }>(`/alerts/rules/${id}`);
export const listAlerts = (datasetId?: string) =>
  get<{ alerts: Alert[] }>("/alerts", { datasetId }).then((r) => r.alerts);
export const ackAlert = (id: string) => patch<{ ok: boolean }>(`/alerts/${id}/ack`);
