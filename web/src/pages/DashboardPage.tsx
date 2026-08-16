import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Bell, Gauge, Info, MessageSquareText, Pause, Play, Radar, Scale, Tags, X } from "lucide-react";
import type { EChartsOption } from "echarts";
import { setSimSpeed, startSimulate, stopSimulate } from "../api/api";
import { useCurrentDataset } from "../hooks/useCurrentDataset";
import { useDatasets, useDatasetStats, useComments } from "../hooks/useData";
import { useDatasetSocket } from "../hooks/useDatasetSocket";
import { customDictKey } from "../lib/customDict";
import EChart from "../components/EChart";
import CommentModal from "../components/CommentModal";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, Select, StatCard } from "../components/ui";
import type { Alert, CommentRow, DatasetStats } from "../api/types";

const SENTIMENT = {
  pos: { label: "正面", color: "#34d399", dot: "bg-emerald-400" },
  neu: { label: "中性", color: "#60a5fa", dot: "bg-sky-400" },
  neg: { label: "负面", color: "#f87171", dot: "bg-red-400" },
} as const;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const { datasetId, setDatasetId } = useCurrentDataset();

  const { data: datasets } = useDatasets();
  // 自定义词典：加入词云统计（localStorage，设置页配置）
  const dictKey = customDictKey();
  const dictParam = dictKey ? { dictionary: dictKey } : undefined;

  const { data: stats } = useDatasetStats(datasetId, dictParam);
  // 主题钻取：点击主题图后按主题筛选评论
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const { data: commentsRes } = useComments(datasetId, { limit: 8, topic: topicFilter ?? undefined });

  // 时段对比：最近 7 天 vs 前 7 天
  const [rangeA, setRangeA] = useState({ from: daysAgo(7), to: daysAgo(0) });
  const [rangeB, setRangeB] = useState({ from: daysAgo(14), to: daysAgo(8) });
  const { data: statsA } = useDatasetStats(datasetId, {
    from: `${rangeA.from}T00:00:00`,
    to: `${rangeA.to}T23:59:59`,
    ...dictParam,
  });
  const { data: statsB } = useDatasetStats(datasetId, {
    from: `${rangeB.from}T00:00:00`,
    to: `${rangeB.to}T23:59:59`,
    ...dictParam,
  });

  // 评论详情弹窗
  const [selectedComment, setSelectedComment] = useState<CommentRow | null>(null);

  // 实时监控状态
  const [liveComments, setLiveComments] = useState<CommentRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [simError, setSimError] = useState<string | null>(null);
  const [inflow, setInflow] = useState(0);
  const [windowSentiments, setWindowSentiments] = useState<CommentRow["sentiment"][]>([]);

  const windowNegRate = windowSentiments.length
    ? Math.round((windowSentiments.filter((s) => s === "neg").length / windowSentiments.length) * 100)
    : 0;

  // 切换数据集时重置实时状态 + 停止旧模拟器
  useEffect(() => {
    setLiveComments([]);
    setAlerts([]);
    setInflow(0);
    setWindowSentiments([]);
    setSimError(null);
    setTopicFilter(null);
    return () => {
      // 切走时停止该数据集的模拟器（重新播放从头开始）；无数据集时跳过空 id 请求
      if (!datasetId) return;
      void stopSimulate(datasetId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);

  // socket 订阅：实时评论 / 告警（含浏览器通知）/ 模拟状态
  useDatasetSocket(datasetId, {
    "comment:stream": (payload) => {
      const c = payload as CommentRow;
      setLiveComments((prev) => [c, ...prev].slice(0, 6));
      setInflow((n) => n + 1);
      setWindowSentiments((prev) => [...prev, c.sentiment].slice(-20));
    },
    "alert:new": (payload) => {
      const a = payload as Alert;
      setAlerts((prev) => [a, ...prev].slice(0, 3));
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(`舆情告警${a.severity === "critical" ? "（严重）" : ""}`, { body: a.message });
        } else if (Notification.permission === "default") {
          void Notification.requestPermission();
        }
      }
    },
    "sim:status": (payload) => setSimRunning((payload as { running: boolean }).running),
  });

  const changeSpeed = async (v: number) => {
    setSpeed(v);
    if (simRunning) {
      try {
        await setSimSpeed(datasetId, v);
      } catch {
        /* 忽略 */
      }
    }
  };

  const toggleSim = async () => {
    setSimError(null);
    try {
      if (simRunning) {
        await stopSimulate(datasetId);
        setSimRunning(false);
      } else {
        const r = await startSimulate(datasetId, speed);
        setSimRunning(true);
        setSpeed(r.speed);
      }
    } catch (e) {
      setSimError(e instanceof Error ? e.message : String(e));
    }
  };

  const current = datasets?.find((d) => d.id === datasetId);

  // 图表 option 用 useMemo 缓存：stats 不变时引用稳定，避免实时流入重渲染触发全图重绘/词云颜色抖动
  const chartOptions = useMemo(() => {
    if (!stats) return null;
    return {
      donut: donutOption(stats),
      trend: trendOption(stats),
      topic: topicOption(stats),
      wordcloud: wordcloudOption(stats),
    };
  }, [stats]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="舆情监控台"
        desc="情感、主题与实时舆情走势一览"
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
            icon={<Radar size={28} strokeWidth={1.6} />}
            title="选择数据集开始监控"
            desc="从右上角选择一个数据集，或先到「导入数据」创建内置场景"
          />
        </div>
      )}

      {datasetId && current && (
        <>
          {/* 概览 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats ? (
              <>
                <StatCard label="评论总数" value={stats.total} sub={current.platform} />
                <StatCard
                  label="已分析"
                  value={stats.analyzed}
                  sub={`${stats.total ? Math.round((stats.analyzed / stats.total) * 100) : 0}% 覆盖率`}
                />
                <StatCard label="正面占比" value={`${pct(stats, "pos")}`} sub={`${stats.sentiment.pos} 条`} accentCls="text-emerald-400" />
                <StatCard label="负面占比" value={`${pct(stats, "neg")}`} sub={`${stats.sentiment.neg} 条`} accentCls="text-red-400" />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-4"><Skeleton className="h-3 w-1/2" /><Skeleton className="mt-2 h-7 w-2/3" /></Card>)
            )}
          </div>

          {/* 实时监控 */}
          <Card className="mt-4">
            <CardHeader icon={<Activity size={15} />} title="实时监控" />
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={speed} onChange={(e) => void changeSpeed(Number(e.target.value))} className="h-8 w-28 text-xs">
                  <option value={1}>1x 慢速</option>
                  <option value={5}>5x 正常</option>
                  <option value={10}>10x 加速</option>
                  <option value={20}>20x 极速</option>
                </Select>
                <Button variant={simRunning ? "danger" : "primary"} size="sm" onClick={() => void toggleSim()}>
                  {simRunning ? <Pause size={13} /> : <Play size={13} />}
                  {simRunning ? "停止" : "播放"}
                </Button>
                <span className="flex items-center gap-1.5 text-[13px] text-ink-400">
                  {simRunning ? (
                    <>
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                      评论实时流入中
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />
                      待机，点击播放开始
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-400">已流入</div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink-100">{inflow}</div>
                </div>
                <div className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-400">窗口负面率</div>
                  <div className={`mt-0.5 text-lg font-semibold tabular-nums ${windowNegRate > 40 ? "text-red-400" : windowNegRate > 20 ? "text-amber-400" : "text-emerald-400"}`}>
                    {windowNegRate}%
                  </div>
                </div>
                <div className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-400">告警</div>
                  <div className={`mt-0.5 text-lg font-semibold tabular-nums ${alerts.length > 0 ? "text-red-400" : "text-ink-100"}`}>
                    {alerts.length}
                  </div>
                </div>
              </div>

              {simError && <div className="mb-3 mt-3 text-xs text-red-400">{simError}</div>}

              <AnimatePresence>
                {alerts.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`mb-2 flex items-start gap-2.5 overflow-hidden rounded-lg border px-3.5 py-2.5 ${
                      a.severity === "critical"
                        ? "border-red-800/60 bg-red-950/40"
                        : "border-amber-800/50 bg-amber-950/30"
                    }`}
                  >
                    <Bell size={15} className={`mt-0.5 shrink-0 ${a.severity === "critical" ? "text-red-400" : "text-amber-400"}`} />
                    <span className={`flex-1 text-[13px] leading-snug ${a.severity === "critical" ? "text-red-200" : "text-amber-200"}`}>
                      {a.message}
                    </span>
                    <button
                      onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
                      className="shrink-0 text-ink-400 transition-colors hover:text-ink-200"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="mt-3 h-56 overflow-hidden">
                {liveComments.length === 0 && !simRunning && (
                  <div className="flex h-full items-center justify-center text-[13px] text-ink-400">
                    点击「播放」后，评论将按时间轴实时流入
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {liveComments.map((c) => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -6, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-1.5 flex items-start gap-2.5 overflow-hidden rounded-lg border border-ink-800 bg-ink-950 px-3 py-2"
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT[c.sentiment].dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] leading-snug text-ink-100">{c.content}</div>
                        <div className="mt-0.5 text-xs text-ink-400">
                          {c.author} · {c.platform}
                        </div>
                      </div>
                      <Badge tone={c.sentiment}>{SENTIMENT[c.sentiment].label}</Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </Card>

          {/* 图表区 */}
          {stats ? (
            <div className="mt-4">
              {stats.analyzed === 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3.5 py-2.5 text-[13px] text-amber-300">
                  <Info size={14} className="shrink-0" />
                  该数据集尚未分析（{stats.total} 条评论待处理），去「智能分析」开始后情感 / 趋势 / 主题将出现数据
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader icon={<Radar size={15} />} title="情感分布" />
                  <div className="p-3">
                    {stats.analyzed === 0 ? (
                      <NotAnalyzed h="h-56" />
                    ) : (
                      <EChart option={chartOptions?.donut ?? {}} className="h-56" />
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHeader icon={<Activity size={15} />} title="评论趋势（按天）" />
                  <div className="p-3">
                    {stats.analyzed === 0 ? (
                      <NotAnalyzed h="h-56" />
                    ) : (
                      <EChart option={chartOptions?.trend ?? {}} className="h-56" />
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHeader
                    icon={<Tags size={15} />}
                    title="热门主题"
                    extra={topicFilter && (
                      <span className="flex items-center gap-1 text-xs text-accent-400">
                        {topicFilter}
                        <button onClick={() => setTopicFilter(null)} className="hover:text-ink-100">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  />
                  <div className="p-3">
                    {stats.analyzed === 0 ? (
                      <NotAnalyzed h="h-52" />
                    ) : (
                      <EChart
                        option={chartOptions?.topic ?? {}}
                        className="h-52"
                        onEvents={{
                          click: (p: unknown) => {
                            const name = (p as { name?: string })?.name;
                            if (name) setTopicFilter(name);
                          },
                        }}
                      />
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHeader icon={<MessageSquareText size={15} />} title="关键词云（内容词频）" />
                  <div className="p-3">
                    <EChart option={chartOptions?.wordcloud ?? {}} className="h-52" />
                  </div>
                </Card>
              </div>

              {/* 时段对比（#6） */}
              <Card className="mt-4">
                <CardHeader icon={<Scale size={15} />} title="时段对比" extra={<span className="text-xs text-ink-400">两个时间段的评论情况对比</span>} />
                <div className="p-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <RangeField label="时段 A" range={rangeA} onChange={setRangeA} />
                    <RangeField label="时段 B" range={rangeB} onChange={setRangeB} />
                  </div>
                  {statsA && statsB && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-ink-800 bg-ink-950 p-3">
                        <div className="mb-2 text-xs font-medium text-ink-300">
                          {rangeA.from} ~ {rangeA.to}（{statsA.total} 条）
                        </div>
                        <EChart option={compareDonut(statsA)} className="h-40" />
                      </div>
                      <div className="rounded-xl border border-ink-800 bg-ink-950 p-3">
                        <div className="mb-2 text-xs font-medium text-ink-300">
                          {rangeB.from} ~ {rangeB.to}（{statsB.total} 条）
                        </div>
                        <EChart option={compareDonut(statsB)} className="h-40" />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="p-4"><Skeleton className="h-52 w-full" /></Card>
              <Card className="p-4"><Skeleton className="h-52 w-full" /></Card>
            </div>
          )}

          {/* 最近评论（可点击看详情 + 主题钻取联动） */}
          <Card className="mt-4">
            <CardHeader
              icon={<Gauge size={15} />}
              title={topicFilter ? `「${topicFilter}」相关评论` : "最近评论"}
              extra={topicFilter && (
                <Button size="sm" variant="ghost" onClick={() => setTopicFilter(null)}>
                  清除筛选
                </Button>
              )}
            />
            <div className="divide-y divide-ink-800">
              {commentsRes?.comments.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedComment(c)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ink-850"
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT[c.sentiment].dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-ink-100">{c.content}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                      <span>{c.author}</span>
                      <span>·</span>
                      <span>{c.platform}</span>
                      <span className="ml-auto tabular-nums">{new Date(c.timestamp).toLocaleString("zh-CN")}</span>
                    </div>
                    {c.topics.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.topics.map((t) => (
                          <span key={t} className="cursor-pointer rounded-md bg-ink-800 px-1.5 py-0.5 text-xs text-ink-300 hover:bg-ink-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      <CommentModal
        key={selectedComment?.id ?? "closed"}
        datasetId={datasetId}
        comment={selectedComment}
        onClose={() => setSelectedComment(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["comments", datasetId] });
          qc.invalidateQueries({ queryKey: ["stats", datasetId] });
        }}
      />
    </div>
  );
}

function RangeField({ label, range, onChange }: { label: string; range: { from: string; to: string }; onChange: (r: { from: string; to: string }) => void }) {
  const inputCls = "h-8 rounded-lg border border-ink-700 bg-ink-950 px-2 text-xs text-ink-100 outline-none focus:border-accent-500";
  return (
    <div className="flex items-end gap-2">
      <span className="pb-1.5 text-xs font-medium text-ink-300">{label}</span>
      <input type="date" value={range.from} onChange={(e) => onChange({ ...range, from: e.target.value })} className={inputCls} />
      <span className="pb-1.5 text-ink-400">~</span>
      <input type="date" value={range.to} onChange={(e) => onChange({ ...range, to: e.target.value })} className={inputCls} />
    </div>
  );
}

function pct(stats: DatasetStats, key: "pos" | "neg"): string {
  return stats.total ? `${Math.round((stats.sentiment[key] / stats.total) * 100)}%` : "0%";
}

function NotAnalyzed({ h }: { h: string }) {
  return (
    <div className={`flex ${h} items-center justify-center rounded-lg border border-dashed border-ink-700 text-[13px] text-ink-400`}>
      尚未分析，待 AI 分析后展示
    </div>
  );
}

function donutOption(stats: DatasetStats): EChartsOption {
  return {
    tooltip: { trigger: "item", backgroundColor: "#152238", borderWidth: 0, textStyle: { color: "#eef2fa" } },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "#a2b2c9", fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["46%", "72%"],
        center: ["50%", "44%"],
        label: { show: false },
        itemStyle: { borderColor: "#101a2b", borderWidth: 2 },
        data: [
          { name: "正面", value: stats.sentiment.pos, itemStyle: { color: SENTIMENT.pos.color } },
          { name: "中性", value: stats.sentiment.neu, itemStyle: { color: SENTIMENT.neu.color } },
          { name: "负面", value: stats.sentiment.neg, itemStyle: { color: SENTIMENT.neg.color } },
        ],
      },
    ],
  };
}

function compareDonut(stats: DatasetStats): EChartsOption {
  return {
    tooltip: { trigger: "item", backgroundColor: "#152238", borderWidth: 0, textStyle: { color: "#eef2fa" } },
    series: [
      {
        type: "pie",
        radius: ["50%", "75%"],
        label: { color: "#c3cede", fontSize: 11, formatter: "{b} {c}" },
        itemStyle: { borderColor: "#101a2b", borderWidth: 2 },
        data: [
          { name: "正面", value: stats.sentiment.pos, itemStyle: { color: SENTIMENT.pos.color } },
          { name: "中性", value: stats.sentiment.neu, itemStyle: { color: SENTIMENT.neu.color } },
          { name: "负面", value: stats.sentiment.neg, itemStyle: { color: SENTIMENT.neg.color } },
        ],
      },
    ],
  };
}

function trendOption(stats: DatasetStats): EChartsOption {
  return {
    tooltip: { trigger: "axis", backgroundColor: "#152238", borderWidth: 0, textStyle: { color: "#eef2fa" } },
    legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: "#a2b2c9", fontSize: 11 } },
    grid: { left: 36, right: 14, top: 30, bottom: 22 },
    xAxis: {
      type: "category",
      data: stats.trend.map((t) => t.date.slice(5)),
      axisLabel: { color: "#7e8fa9", fontSize: 11 },
      axisLine: { lineStyle: { color: "#2f4063" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#7e8fa9", fontSize: 11 },
      splitLine: { lineStyle: { color: "#152238" } },
    },
    series: [
      { name: "正面", type: "line", smooth: true, showSymbol: false, data: stats.trend.map((t) => t.pos), lineStyle: { color: SENTIMENT.pos.color, width: 2 }, itemStyle: { color: SENTIMENT.pos.color }, areaStyle: { color: "rgba(52,211,153,0.12)" } },
      { name: "中性", type: "line", smooth: true, showSymbol: false, data: stats.trend.map((t) => t.neu), lineStyle: { color: SENTIMENT.neu.color, width: 2 }, itemStyle: { color: SENTIMENT.neu.color }, areaStyle: { color: "rgba(96,165,250,0.10)" } },
      { name: "负面", type: "line", smooth: true, showSymbol: false, data: stats.trend.map((t) => t.neg), lineStyle: { color: SENTIMENT.neg.color, width: 2 }, itemStyle: { color: SENTIMENT.neg.color }, areaStyle: { color: "rgba(248,113,113,0.14)" } },
    ],
  };
}

function topicOption(stats: DatasetStats): EChartsOption {
  const top = stats.topics.slice(0, 8).reverse();
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#152238", borderWidth: 0, textStyle: { color: "#eef2fa" } },
    grid: { left: 8, right: 26, top: 6, bottom: 6, containLabel: true },
    xAxis: { type: "value", axisLabel: { color: "#7e8fa9", fontSize: 11 }, splitLine: { lineStyle: { color: "#152238" } } },
    yAxis: {
      type: "category",
      data: top.map((t) => t.name),
      axisLabel: { color: "#c3cede", fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: top.map((t, i) => ({
          value: t.count,
          itemStyle: { color: i >= top.length - 3 ? "#f87171" : "#fbbf24", borderRadius: [0, 4, 4, 0] },
        })),
        barWidth: 14,
      },
    ],
  };
}

function wordcloudOption(stats: DatasetStats): EChartsOption {
  // 圆形散落词云（评价词典提取的真词），仅水平排布保持可读
  // 颜色按词名稳定 hash，避免每次渲染随机变色抖动
  const colorOf = (name: string) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 50;
    return `hsl(${36 + h}, 65%, 62%)`;
  };
  return {
    tooltip: { backgroundColor: "#152238", borderWidth: 0, textStyle: { color: "#eef2fa" } },
    series: [
      {
        type: "wordCloud",
        shape: "circle",
        width: "100%",
        height: "100%",
        sizeRange: [13, 36],
        rotationRange: [0, 0],
        layoutAnimation: true,
        textStyle: {
          color: (p: { name?: string }) => colorOf(p?.name ?? "词"),
        },
        data: stats.keywords.map((k) => ({ name: k.word, value: k.count })),
      },
    ],
  };
}
