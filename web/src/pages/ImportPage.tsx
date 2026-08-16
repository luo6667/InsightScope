import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardPaste, Clock, FileDown, FileSpreadsheet, FileUp, MessagesSquare, Radio, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createFeedDataset, createScenarioDataset, importComments, listScenarios } from "../api/api";
import { Button, Card, Field, Input, PageHeader, Textarea } from "../components/ui";
import type { ScenarioInfo } from "../api/types";

export default function ImportPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: scenarios } = useQuery({ queryKey: ["scenarios"], queryFn: listScenarios });

  const create = useMutation({
    mutationFn: (scenarioId: string) => createScenarioDataset(scenarioId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["datasets"] });
      navigate(`/dashboard?dataset=${r.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader title="导入数据" desc="内置舆情场景已预标注（免 key 演示），或粘贴 / CSV / URL 定时抓取导入" />

      <h2 className="mt-8 flex items-center gap-2 text-sm font-medium text-ink-200">
        <FileUp size={15} className="text-accent-400" />
        内置舆情场景
      </h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {scenarios?.map((s, i) => (
          <ScenarioCard
            key={s.id}
            s={s}
            featured={i === 0}
            busy={create.isPending}
            onClick={() => create.mutate(s.id)}
          />
        ))}
      </div>

      <h2 className="mt-9 flex items-center gap-2 text-sm font-medium text-ink-200">
        <ClipboardPaste size={15} className="text-accent-400" />
        粘贴评论导入
      </h2>
      <div className="mt-3">
        <PasteImport onCreate={(name, comments) => importComments(comments, name)} onDone={(id) => navigate(`/dashboard?dataset=${id}`)} />
      </div>

      <h2 className="mt-9 flex items-center gap-2 text-sm font-medium text-ink-200">
        <FileSpreadsheet size={15} className="text-accent-400" />
        CSV 文件导入
      </h2>
      <div className="mt-3">
        <CsvImport onCreate={(comments) => importComments(comments)} onDone={(id) => navigate(`/dashboard?dataset=${id}`)} />
      </div>

      <h2 className="mt-9 flex items-center gap-2 text-sm font-medium text-ink-200">
        <Radio size={15} className="text-accent-400" />
        URL 定时抓取
      </h2>
      <div className="mt-3">
        <FeedImport onCreate={(name, url, interval) => createFeedDataset(name, url, interval)} onDone={(id) => navigate(`/dashboard?dataset=${id}`)} />
      </div>
    </div>
  );
}

function ScenarioCard({ s, featured, busy, onClick }: { s: ScenarioInfo; featured?: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`group text-left transition-all duration-150 disabled:opacity-50 ${
        featured ? "lg:col-span-2" : ""
      }`}
    >
      <Card hover className={`flex items-start gap-4 p-5 ${featured ? "lg:flex-row lg:items-center" : ""}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-accent-400 transition-colors group-hover:bg-accent-500/15">
          <MessagesSquare size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-100">{s.name}</span>
            {featured && <Badge tone="accent">推荐演示</Badge>}
          </div>
          <p className={`mt-1 text-[13px] leading-relaxed text-ink-400 ${featured ? "lg:max-w-xl" : ""}`}>{s.description}</p>
          <div className="mt-3 flex items-center gap-4 text-[13px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <MessagesSquare size={12} className="text-ink-500" />
              <span className="tabular-nums">{s.count}</span> 条评论
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-ink-500" />
              {s.days} 天时间线
            </span>
            <span className="ml-auto flex items-center gap-1 text-accent-400 opacity-0 transition-opacity group-hover:opacity-100">
              导入
              <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </Card>
    </button>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  const cls = tone === "accent" ? "bg-accent-500/10 text-accent-400" : "bg-ink-800 text-ink-300";
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function PasteImport({ onCreate, onDone }: { onCreate: (name: string, c: unknown[]) => Promise<{ id: string; count: number }>; onDone: (id: string) => void }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await onCreate(name.trim(), lines.map((content) => ({ content, analyzed: false })));
      onDone(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <Field label="数据集名称（可选）">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：某电商平台 7 月用户反馈"
          className="h-9 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-accent-500"
        />
      </Field>
      <div className="mt-3">
        <Field label="评论内容（每行一条）">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={"快递太慢了，等了三天才到\n客服态度很好，问题解决很快\n手机用起来很流畅，性能不错"}
          />
        </Field>
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      <div className="mt-4">
        <Button variant="primary" onClick={() => void submit()} disabled={loading || !text.trim()}>
          <FileUp size={15} />
          {loading ? "导入中…" : "导入评论"}
        </Button>
      </div>
    </Card>
  );
}

interface CsvRow {
  content: string;
  author?: string;
  platform?: string;
  sentiment?: string;
}

/** 解析单行 CSV：支持双引号包裹字段、引号内逗号、转义引号 "" */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** 简单 CSV 解析：首行表头，支持中文/英文列名，引号包裹字段 */
function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const findCol = (names: string[]) => {
    const idx = header.findIndex((h) => names.includes(h.toLowerCase()));
    return idx >= 0 ? idx : -1;
  };
  const colContent = Math.max(0, findCol(["content", "评论", "内容", "text"]));
  const colAuthor = findCol(["author", "作者", "用户", "昵称"]);
  const colPlatform = findCol(["platform", "平台", "来源"]);
  const colSentiment = findCol(["sentiment", "情感", "情绪"]);

  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const content = cells[colContent] ?? "";
    if (!content) continue;
    const row: CsvRow = { content };
    if (colAuthor >= 0) row.author = cells[colAuthor];
    if (colPlatform >= 0) row.platform = cells[colPlatform];
    if (colSentiment >= 0) row.sentiment = cells[colSentiment];
    rows.push(row);
  }
  return rows;
}

function CsvImport({ onCreate, onDone }: { onCreate: (c: unknown[]) => Promise<{ id: string; count: number }>; onDone: (id: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length === 0) {
        setRows(null);
        setError("未能解析出评论，请确认 CSV 首行包含列名（content / 评论 / 内容）");
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file, "utf-8");
  };

  const submit = async () => {
    if (!rows || rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await onCreate(
        rows.map((row) => ({
          content: row.content,
          author: row.author,
          platform: row.platform,
          sentiment: row.sentiment,
          analyzed: false,
        }))
      );
      onDone(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <UploadCloud size={15} />
          选择 CSV 文件
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadCsvTemplate}>
          <FileDown size={13} />
          下载 CSV 模板
        </Button>
        {fileName && <span className="text-xs text-ink-400">{fileName}</span>}
        {rows && rows.length > 0 && (
          <>
            <span className="text-xs text-ink-400">
              解析出 <span className="tabular-nums text-ink-200">{rows.length}</span> 条评论
            </span>
            <Button variant="primary" size="sm" onClick={() => void submit()} disabled={loading}>
              <FileUp size={13} />
              {loading ? "导入中…" : "导入"}
            </Button>
          </>
        )}
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      {rows && rows.length > 0 && (
        <div className="mt-3 rounded-lg border border-ink-800 bg-ink-950 p-3">
          <div className="mb-2 text-xs text-ink-400">预览（前 3 条）</div>
          <div className="space-y-1.5">
            {rows.slice(0, 3).map((r, i) => (
              <div key={i} className="truncate text-[13px] text-ink-200">
                <span className="text-ink-500">{i + 1}.</span> {r.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** 下载 CSV 模板（带 UTF-8 BOM，Excel 打开不乱码） */
function downloadCsvTemplate() {
  const csv = [
    "评论,作者,平台,情感",
    "快递太慢了，等了三天才到,小明,淘宝,neg",
    "客服态度很好，问题解决很快,小红,京东,pos",
    "手机用起来很流畅，性能不错,阿伟,天猫,pos",
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "评论导入模板.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function FeedImport({
  onCreate,
  onDone,
}: {
  onCreate: (name: string, url: string, interval: number) => Promise<{ id: string }>;
  onDone: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await onCreate(name.trim() || "定时抓取数据源", url.trim(), interval);
      onDone(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="数据集名称（可选）">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：官网用户反馈" />
        </Field>
        <Field label="抓取间隔（分钟）">
          <Input
            type="number"
            min={1}
            max={1440}
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="数据源 URL" hint="返回 JSON 数组（或 { comments: [...] }）的接口，字段支持 content/author/platform/sentiment">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://jsonplaceholder.typicode.com/comments" />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Button size="sm" variant="outline" onClick={() => setUrl("/api/demo/feed")}>
          本地演示数据源
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setUrl("https://jsonplaceholder.typicode.com/comments")}>
          JSONPlaceholder 公开 API
        </Button>
        <span className="text-ink-400">先演示用「本地演示数据源」，无需联网</span>
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      <div className="mt-4">
        <Button variant="primary" onClick={() => void submit()} disabled={loading || !url.trim()}>
          <Radio size={15} />
          {loading ? "创建中…" : "创建并开始定时抓取"}
        </Button>
      </div>
    </Card>
  );
}
