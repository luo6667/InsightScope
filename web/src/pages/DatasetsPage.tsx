import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Database, Download, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { deleteDataset, exportComments, pullFeedNow, startFeedPull, stopFeedPull } from "../api/api";
import { useDatasets } from "../hooks/useData";
import { Badge, Button, Card, CardSkeleton, EmptyState, PageHeader } from "../components/ui";

const typeLabel: Record<string, string> = { builtin: "内置场景", imported: "导入数据", feed: "定时抓取" };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function DatasetsPage() {
  const qc = useQueryClient();
  const { data: datasets, isLoading, error } = useDatasets(8000);
  const [actionError, setActionError] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
    onError: (e) => setActionError(`删除失败：${errMsg(e)}`),
  });
  const feedStart = useMutation({
    mutationFn: startFeedPull,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
    onError: (e) => setActionError(`启动抓取失败：${errMsg(e)}`),
  });
  const feedStop = useMutation({
    mutationFn: stopFeedPull,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
    onError: (e) => setActionError(`停止抓取失败：${errMsg(e)}`),
  });
  const feedPull = useMutation({
    mutationFn: pullFeedNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
    onError: (e) => setActionError(`抓取失败：${errMsg(e)}`),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="数据集"
        desc="评论数据源，选择后进入监控台与分析"
        extra={
          <Link to="/import">
            <Button variant="primary">
              <Plus size={15} />
              导入数据
            </Button>
          </Link>
        }
      />

      <div className="mt-6 space-y-2.5">
        {isLoading && <CardSkeleton rows={3} />}
        {error && <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">{(error as Error).message}</div>}
        {actionError && (
          <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {actionError}
            <button className="ml-2 underline" onClick={() => setActionError(null)}>
              关闭
            </button>
          </div>
        )}

        {datasets && datasets.length === 0 && (
          <EmptyState
            icon={<Database size={26} strokeWidth={1.6} />}
            title="还没有数据集"
            desc="导入内置场景 / 粘贴评论 / CSV 文件 / URL 定时抓取，四种方式任选"
            action={
              <Link to="/import">
                <Button variant="primary">
                  <Plus size={15} />
                  去导入
                </Button>
              </Link>
            }
          />
        )}

        {datasets?.map((d) => (
          <Card key={d.id} hover className="flex items-center gap-4 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-accent-400">
              <Database size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink-100">{d.name}</span>
                <Badge tone={d.type === "builtin" ? "accent" : d.type === "feed" ? "pos" : "neutral"}>
                  {typeLabel[d.type]}
                </Badge>
                {d.type === "feed" && d.feedRunning && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    运行中
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-400">
                <span className="tabular-nums">{d.commentCount}</span> 条评论 · 已分析{" "}
                <span className="tabular-nums">{d.analyzedCount}</span>
                {d.type === "feed" && d.feedLastAt && (
                  <>
                    {" · "}最近抓取{" "}
                    <span className="tabular-nums text-ink-200">{d.feedLastCount}</span> 条（
                    {new Date(d.feedLastAt).toLocaleTimeString("zh-CN")}）
                  </>
                )}
                {d.type === "feed" && d.feedLastError && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle size={11} />
                    抓取失败：{d.feedLastError}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {d.type === "feed" && (
                <>
                  {d.feedRunning ? (
                    <Button size="sm" variant="ghost" onClick={() => feedStop.mutate(d.id)}>
                      <Pause size={12} />
                      停止
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => feedStart.mutate(d.id)}>
                      <Play size={12} />
                      启动
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" title="立即抓取一次" onClick={() => feedPull.mutate(d.id)}>
                    <RefreshCw size={12} />
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" title="导出 CSV" onClick={() => exportComments(d.id, "csv")}>
                <Download size={12} />
              </Button>
              <Link to={`/dashboard?dataset=${d.id}`}>
                <Button size="sm">
                  监控台
                  <ArrowRight size={13} />
                </Button>
              </Link>
              <Link to={`/analysis?dataset=${d.id}`}>
                <Button size="sm">分析</Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`确认删除「${d.name}」及其评论？`)) del.mutate(d.id);
                }}
              >
                <Trash2 size={13} className="text-ink-400 hover:text-red-400" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
