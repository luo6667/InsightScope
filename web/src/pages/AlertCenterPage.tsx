import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, Check, Plus, Trash2 } from "lucide-react";
import { ackAlert, createRule, deleteRule, updateRule } from "../api/api";
import { useCurrentDataset } from "../hooks/useCurrentDataset";
import { useDatasets, useAlertRules, useAlerts } from "../hooks/useData";
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Select } from "../components/ui";

const typeLabel: Record<string, string> = {
  negativity: "负面率阈值",
  volume: "评论量",
  keyword: "敏感关键词",
};

const ruleTone: Record<string, "neg" | "neutral" | "accent"> = {
  negativity: "neg",
  volume: "neutral",
  keyword: "accent",
};

export default function AlertCenterPage() {
  const { datasetId, setDatasetId } = useCurrentDataset();
  const qc = useQueryClient();

  const { data: datasets } = useDatasets();
  const { data: rules } = useAlertRules(datasetId);
  const { data: alerts } = useAlerts(datasetId);

  const del = useMutation({ mutationFn: deleteRule, onSuccess: () => qc.invalidateQueries({ queryKey: ["rules", datasetId] }) });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateRule(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules", datasetId] }),
  });
  const ack = useMutation({ mutationFn: ackAlert, onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts", datasetId] }) });

  const unacked = alerts?.filter((a) => !a.acknowledged).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="告警中心"
        desc="配置规则，实时模拟或分析时会自动检测并推送"
        extra={
          <div className="flex items-center gap-3">
            {unacked > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                {unacked} 条未确认
              </span>
            )}
            <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} className="w-56">
              <option value="">选择数据集…</option>
              {datasets?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {!datasetId && (
        <div className="mt-8">
          <EmptyState
            icon={<Bell size={26} strokeWidth={1.6} />}
            title="选择数据集配置告警"
            desc="支持负面率阈值 / 评论量 / 敏感关键词三种规则，实时模拟时自动检测"
          />
        </div>
      )}

      {datasetId && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* 规则 */}
          <Card>
            <CardHeader icon={<BellRing size={15} />} title="告警规则" />
            <div className="space-y-2 p-4">
              <RuleForm datasetId={datasetId} />
              {rules?.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2.5">
                  <Badge tone={ruleTone[r.type]}>{typeLabel[r.type]}</Badge>
                  <span className="flex-1 text-sm text-ink-200">
                    {r.type === "keyword" ? (
                      <>含「<span className="text-ink-100">{r.keyword}</span>」</>
                    ) : (
                      <>阈值 <span className="tabular-nums text-ink-100">{r.threshold}</span>{r.type === "negativity" ? "%" : " 条"}</>
                    )}
                  </span>
                  <button
                    onClick={() => toggle.mutate({ id: r.id, enabled: !r.enabled })}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      r.enabled ? "bg-accent-500/15 text-accent-400" : "bg-ink-800 text-ink-400"
                    }`}
                  >
                    {r.enabled ? "启用中" : "已停用"}
                  </button>
                  <button onClick={() => del.mutate(r.id)} className="text-ink-400 transition-colors hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {rules?.length === 0 && (
                <div className="py-4 text-center text-xs text-ink-400">暂无规则，添加一条试试</div>
              )}
            </div>
          </Card>

          {/* 告警记录（时间线） */}
          <Card>
            <CardHeader icon={<Bell size={15} />} title="告警记录" extra={<span className="text-xs text-ink-400">{alerts?.length ?? 0} 条</span>} />
            <div className="max-h-[420px] overflow-y-auto p-4">
              {alerts?.length === 0 && <div className="py-6 text-center text-xs text-ink-400">暂无告警</div>}
              <div className="relative space-y-3 pl-4">
                <div className="absolute bottom-1 left-[5px] top-1 w-px bg-ink-800" />
                {alerts?.map((a) => (
                  <div key={a.id} className="relative">
                    <span
                      className={`absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-ink-900 ${
                        a.severity === "critical" ? "bg-red-400" : "bg-amber-400"
                      }`}
                    />
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        a.severity === "critical" ? "border-red-800/50 bg-red-950/25" : "border-amber-800/40 bg-amber-950/15"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`flex-1 text-sm leading-snug ${a.severity === "critical" ? "text-red-200" : "text-amber-200"}`}>
                          {a.message}
                        </span>
                        {!a.acknowledged && (
                          <Button size="sm" variant="outline" onClick={() => ack.mutate(a.id)}>
                            <Check size={12} />
                            确认
                          </Button>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        {typeLabel[a.type]} · {new Date(a.triggeredAt).toLocaleString("zh-CN")}
                        {a.acknowledged && " · 已确认"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function RuleForm({ datasetId }: { datasetId: string }) {
  const qc = useQueryClient();
  const [type, setType] = useState("negativity");
  const [threshold, setThreshold] = useState("50");
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: createRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules", datasetId] });
      setKeyword("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  const submit = () => {
    setError(null);
    add.mutate({
      datasetId,
      type,
      threshold: type === "keyword" ? 1 : Number(threshold),
      keyword: type === "keyword" ? keyword.trim() : undefined,
    });
  };

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-950 p-3.5">
      <div className="flex gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="h-8 w-32 text-xs">
          <option value="negativity">负面率阈值</option>
          <option value="volume">评论量</option>
          <option value="keyword">敏感关键词</option>
        </Select>
        {type === "keyword" ? (
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="关键词，如 闪退"
            className="h-8 min-w-0 flex-1 text-xs"
          />
        ) : (
          <Input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            type="number"
            placeholder={type === "negativity" ? "百分比" : "条数"}
            className="h-8 w-24 text-xs"
          />
        )}
        <Button size="sm" variant="primary" onClick={submit} disabled={type === "keyword" ? !keyword.trim() : !threshold}>
          <Plus size={13} />
          添加
        </Button>
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}
