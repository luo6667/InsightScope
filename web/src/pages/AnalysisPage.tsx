import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, BrainCircuit, Eraser, Pause, Play, RotateCcw, Square } from "lucide-react";
import { cancelAnalysis, pauseAnalysis, resetAnalysis, resumeAnalysis, startAnalysis } from "../api/api";
import { useCurrentDataset } from "../hooks/useCurrentDataset";
import { useDatasets, useAnalysisJob } from "../hooks/useData";
import { useDatasetSocket } from "../hooks/useDatasetSocket";
import { useSettings } from "../store/settings";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Select } from "../components/ui";

const jobTone: Record<string, "neutral" | "pos" | "neg" | "accent"> = {
  pending: "neutral",
  running: "accent",
  paused: "neutral",
  done: "pos",
  failed: "neg",
};

export default function AnalysisPage() {
  const { datasetId, setDatasetId } = useCurrentDataset();
  const settings = useSettings();
  const qc = useQueryClient();

  const { data: datasets } = useDatasets();
  const { data: job } = useAnalysisJob(datasetId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // socket 进度实时推送
  useDatasetSocket(datasetId, {
    "analysis:progress": () => qc.invalidateQueries({ queryKey: ["job", datasetId] }),
  });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["job", datasetId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;
  const active = job && ["running", "pending", "paused"].includes(job.status);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="智能分析"
        desc="AI 批量分析评论：情感 / 主题 / 关键词"
        extra={
          <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className="w-56">
            <option value="">选择数据集…</option>
            {datasets?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}（{d.commentCount} 条）
              </option>
            ))}
          </Select>
        }
      />

      {!datasetId && (
        <div className="mt-8">
          <EmptyState
            icon={<BrainCircuit size={26} strokeWidth={1.6} />}
            title="选择数据集开始分析"
            desc="内置场景已预标注可直接查看，导入数据需配置 API key 后分析"
          />
        </div>
      )}

      {datasetId && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={busy || !!active} onClick={() => void run(() => startAnalysis(datasetId, {
              apiKey: settings.apiKey,
              baseUrl: settings.baseUrl,
              model: settings.model,
              temperature: settings.temperature,
              concurrency: 6,
            }))}>
              <Play size={15} />
              开始分析
            </Button>
            {job?.status === "running" && (
              <Button variant="outline" onClick={() => void run(() => pauseAnalysis(datasetId))}>
                <Pause size={14} />
                暂停
              </Button>
            )}
            {job?.status === "paused" && (
              <Button variant="outline" onClick={() => void run(() => resumeAnalysis(datasetId))}>
                <RotateCcw size={14} />
                恢复
              </Button>
            )}
            {active && (
              <Button variant="danger" onClick={() => void run(() => cancelAnalysis(datasetId))}>
                <Square size={14} />
                取消
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (confirm("确认清空该数据集的全部分析结果？评论将重置为未分析状态，可重新分析。")) {
                  void run(() => resetAnalysis(datasetId)).then(() => qc.invalidateQueries({ queryKey: ["stats", datasetId] }));
                }
              }}
            >
              <Eraser size={14} />
              清空分析结果
            </Button>
          </div>

          {!settings.apiKey && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-950/25 px-3.5 py-2.5 text-xs text-amber-300">
              <AlertTriangle size={14} className="shrink-0" />
              尚未配置 API key（内置场景已预标注，无需分析）。到「设置」填入后即可分析导入的数据。
            </div>
          )}
          {error && <div className="mt-3 text-xs text-red-400">{error}</div>}

          {job && (
            <Card className="mt-5">
              <CardHeader
                icon={<BrainCircuit size={15} />}
                title={`分析任务 · ${job.status === "done" ? "已完成" : job.status === "failed" ? "失败" : job.status === "paused" ? "已暂停" : "进行中"}`}
                extra={<Badge tone={jobTone[job.status]}>{job.status}</Badge>}
              />
              <div className="p-5">
                <div className="flex items-center justify-between text-[13px] text-ink-300">
                  <span className="tabular-nums">
                    {job.processed} / {job.total} 条
                  </span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <motion.div
                    className="h-full rounded-full bg-accent-500"
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-ink-400">
                  <span>失败 <span className="tabular-nums text-red-400">{job.failed}</span></span>
                  <span>并发 <span className="tabular-nums">{job.concurrency}</span></span>
                </div>
              </div>
            </Card>
          )}

          {job?.status === "done" && (
            <div className="mt-4 rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
              分析完成，去「监控台」查看情感分布 / 主题 / 趋势图表
            </div>
          )}
        </>
      )}
    </div>
  );
}
