import { useEffect, useRef, useState } from "react";
import { Clock, FileDown, FileText, Loader2, Trash2, Wand2 } from "lucide-react";
import { useCurrentDataset } from "../hooks/useCurrentDataset";
import { useDatasets, useDatasetStats } from "../hooks/useData";
import { useSettings } from "../store/settings";
import { streamChat } from "../lib/ai";
import { Button, Card, CardHeader, EmptyState, PageHeader, Select } from "../components/ui";
import type { DatasetStats } from "../api/types";

const REPORT_SYSTEM = `你是舆情分析专家。基于用户提供的评论统计数据，用中文 Markdown 输出一份「舆情周报」，结构：
# 舆情周报
## 一、总体态势（2-3 句话概述）
## 二、情感分析（正面/中性/负面占比 + 解读）
## 三、热点主题（top 主题及原因推测）
## 四、风险与负面问题（重点列负面主题/高发问题）
## 五、改进建议（3-5 条可执行建议）
要求：数据必须来自给定统计，禁止编造数字；语言简洁专业；用 Markdown 标题与列表。`;

interface SavedReport {
  id: string;
  datasetId: string;
  datasetName: string;
  createdAt: string;
  content: string;
}

const HISTORY_KEY = "insight-reports";

function loadHistory(): SavedReport[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as SavedReport[];
  } catch {
    return [];
  }
}

function buildStatsText(stats: DatasetStats): string {
  const total = Math.max(1, stats.total);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  const topics = stats.topics.slice(0, 8).map((t) => `${t.name}(${t.count})`).join("、");
  const lastDays = stats.trend.slice(-7);
  const trendText = lastDays.length
    ? lastDays.map((d) => `${d.date}: 正${d.pos}/中${d.neu}/负${d.neg}`).join("；")
    : "无趋势数据";
  return [
    `评论总数：${stats.total}（已分析 ${stats.analyzed}）`,
    `情感分布：正面 ${stats.sentiment.pos}（${pct(stats.sentiment.pos)}）、中性 ${stats.sentiment.neu}（${pct(stats.sentiment.neu)}）、负面 ${stats.sentiment.neg}（${pct(stats.sentiment.neg)}）`,
    `热点主题：${topics || "无"}`,
    `近 7 天趋势：${trendText}`,
  ].join("\n");
}

export default function ReportsPage() {
  const { datasetId, setDatasetId } = useCurrentDataset();
  const settings = useSettings();

  const { data: datasets } = useDatasets();
  const { data: stats } = useDatasetStats(datasetId);

  const [report, setReport] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 历史记录按数据集各自隔离
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [activeHistory, setActiveHistory] = useState<SavedReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 生成代数：切换数据集/重复点击时使旧流失效，防止增量错写进新数据集
  const genIdRef = useRef(0);
  const genDatasetRef = useRef("");

  useEffect(() => {
    setHistory(loadHistory().filter((h) => h.datasetId === datasetId));
    setActiveHistory(null);
    // 切换数据集时终止仍在跑的旧流
    abortRef.current?.abort();
  }, [datasetId]);

  // 卸载时终止流
  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async () => {
    if (!datasetId || !stats || generating) return;
    abortRef.current?.abort(); // 终止旧流（若有）
    const genId = ++genIdRef.current;
    genDatasetRef.current = datasetId;
    const curDataset = datasetId;
    setGenerating(true);
    setError(null);
    setReport("");
    setActiveHistory(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamChat(
        settings,
        [
          { role: "system", content: REPORT_SYSTEM },
          { role: "user", content: buildStatsText(stats) },
        ],
        (d) => {
          // 已切换到其他数据集或已被 abort：丢弃过期增量，避免污染新报告
          if (genIdRef.current !== genId || genDatasetRef.current !== curDataset || ac.signal.aborted) return;
          setReport((t) => t + d);
        },
        ac.signal
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      // 只有最新一次生成才复位按钮状态
      if (genIdRef.current === genId) setGenerating(false);
    }
  };

  // 生成完成时自动存入历史（绑定生成时所属数据集，防止切数据集后错存）
  useEffect(() => {
    if (!report || generating || !datasetId) return;
    if (genDatasetRef.current !== datasetId) return; // 本次报告属于其他数据集，不写入当前数据集历史
    const datasetName = datasets?.find((d) => d.id === datasetId)?.name ?? "数据集";
    const item: SavedReport = {
      id: `${Date.now()}`,
      datasetId,
      datasetName,
      createdAt: new Date().toLocaleString("zh-CN"),
      content: report,
    };
    const next = [item, ...loadHistory()].slice(0, 100);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next.filter((h) => h.datasetId === datasetId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, generating, datasetId]);

  const exportMd = (text: string) => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `舆情周报-${new Date().toLocaleDateString("zh-CN")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeHistory = (id: string) => {
    const next = loadHistory().filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next.filter((h) => h.datasetId === datasetId));
    if (activeHistory?.id === id) setActiveHistory(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="舆情报告"
        desc="AI 基于统计数据自动生成舆情周报（流式输出，自动保存历史）"
        extra={
          <Select value={datasetId} onChange={(e) => { setDatasetId(e.target.value); setReport(""); }} className="w-56">
            <option value="">选择数据集…</option>
            {datasets?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        }
      />

      {!datasetId && history.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={<FileText size={26} strokeWidth={1.6} />}
            title="选择数据集生成报告"
            desc="报告为五段式结构：总体态势 / 情感分析 / 热点主题 / 风险与负面 / 改进建议"
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* 生成区 */}
        <div>
          {datasetId && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => void generate()} disabled={!stats || generating}>
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {generating ? "生成中…" : "生成舆情周报"}
              </Button>
              {report && (
                <Button variant="outline" onClick={() => exportMd(report)}>
                  <FileDown size={15} />
                  导出 Markdown
                </Button>
              )}
            </div>
          )}

          {datasetId && !settings.apiKey && (
            <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/25 px-3.5 py-2.5 text-xs text-amber-300">
              尚未配置 API key，先到「设置」填入
            </div>
          )}
          {error && <div className="mt-3 text-xs text-red-400">{error}</div>}

          <Card className="mt-4">
            <CardHeader icon={<FileText size={15} />} title={activeHistory ? `历史报告 · ${activeHistory.datasetName}` : "舆情周报"} />
            <div className="min-h-40 p-5">
              {!report && !generating && !activeHistory && (
                <div className="flex h-40 items-center justify-center text-xs text-ink-400">
                  {datasetId ? "选择数据集后点击「生成舆情周报」" : "从右侧历史记录查看，或选择数据集生成"}
                </div>
              )}
              {generating && !report && (
                <div className="flex h-40 items-center justify-center gap-2 text-xs text-ink-400">
                  <Loader2 size={14} className="animate-spin text-accent-400" />
                  AI 正在撰写报告…
                </div>
              )}
              {(report || activeHistory) && (
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-100">
                  {activeHistory ? activeHistory.content : report}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 历史列表（当前数据集） */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-300">
            <Clock size={13} className="text-ink-400" />
            {datasetId && datasets?.find((d) => d.id === datasetId)
              ? `${datasets.find((d) => d.id === datasetId)?.name} 的历史（${history.length}）`
              : `历史报告（${history.length}）`}
          </div>
          <div className="space-y-2">
            {history.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink-700 p-4 text-center text-xs text-ink-400">
                暂无历史报告
              </div>
            )}
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border border-ink-800 bg-ink-900 p-3">
                <button onClick={() => setActiveHistory(h)} className="w-full text-left">
                  <div className="truncate text-[13px] font-medium text-ink-100">{h.datasetName}</div>
                  <div className="mt-0.5 text-[11px] text-ink-400">{h.createdAt}</div>
                </button>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={() => exportMd(h.content)}
                    className="rounded bg-ink-800 px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-700"
                  >
                    导出
                  </button>
                  <button
                    onClick={() => removeHistory(h.id)}
                    className="rounded px-2 py-0.5 text-[11px] text-ink-400 hover:text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
