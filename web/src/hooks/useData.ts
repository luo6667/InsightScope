import { useQuery } from "@tanstack/react-query";
import {
  getJob,
  getStats,
  listAlerts,
  listComments,
  listDatasets,
  listRules,
} from "../api/api";

/** 数据集列表（可指定轮询间隔，如 feed 数据集 8s 刷新） */
export function useDatasets(refetchInterval = 0) {
  return useQuery({ queryKey: ["datasets"], queryFn: listDatasets, refetchInterval });
}

/** 数据集聚合统计（支持时间过滤 / 自定义词典参数） */
export function useDatasetStats(datasetId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["stats", datasetId, JSON.stringify(params ?? {})],
    queryFn: () => getStats(datasetId, params),
    enabled: !!datasetId,
  });
}

/** 评论分页列表 */
export function useComments(datasetId: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["comments", datasetId, JSON.stringify(params ?? {})],
    queryFn: () => listComments(datasetId, params),
    enabled: !!datasetId,
  });
}

/** 最新分析任务（running/paused 时轮询） */
export function useAnalysisJob(datasetId: string) {
  return useQuery({
    queryKey: ["job", datasetId],
    queryFn: () => getJob(datasetId),
    enabled: !!datasetId,
    refetchInterval: (q) => {
      const j = q.state.data as { status?: string } | null;
      return j && ["running", "pending", "paused"].includes(j.status ?? "") ? 3000 : false;
    },
  });
}

/** 告警规则列表 */
export function useAlertRules(datasetId: string) {
  return useQuery({
    queryKey: ["rules", datasetId],
    queryFn: () => listRules(datasetId),
    enabled: !!datasetId,
  });
}

/** 告警记录列表 */
export function useAlerts(datasetId: string) {
  return useQuery({
    queryKey: ["alerts", datasetId],
    queryFn: () => listAlerts(datasetId),
    enabled: !!datasetId,
    refetchInterval: 5000,
  });
}
