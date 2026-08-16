import { useState } from "react";
import { BookMarked, Check, KeyRound, ShieldCheck } from "lucide-react";
import { useSettings } from "../store/settings";
import { getCustomDict, setCustomDict } from "../lib/customDict";
import { Button, Card, CardHeader, Field, Input, PageHeader, Textarea } from "../components/ui";

export default function SettingsPage() {
  const s = useSettings();
  const [draft, setDraft] = useState({ ...s });
  const [saved, setSaved] = useState(false);
  const [dictText, setDictText] = useState(getCustomDict().join("\n"));
  const [dictSaved, setDictSaved] = useState(false);

  const keyClean = draft.apiKey.trim().replace(/\s+/g, "");
  const keyInvalid = !!draft.apiKey && !/^[\x20-\x7e]+$/.test(keyClean);
  const urlInvalid = !!draft.baseUrl.trim() && !/^[\x20-\x7e]+$/.test(draft.baseUrl.trim());

  const save = () => {
    if (keyInvalid || urlInvalid) return;
    // temperature 防 NaN / 越界
    const rawTemp = Number(draft.temperature);
    const temperature = Number.isFinite(rawTemp) ? Math.min(2, Math.max(0, rawTemp)) : 0.2;
    s.update({ ...draft, apiKey: keyClean, baseUrl: draft.baseUrl.trim(), temperature });
    setDraft({ ...draft, apiKey: keyClean, baseUrl: draft.baseUrl.trim(), temperature });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveDict = () => {
    const words = dictText.split(/[\n,，、]+/).map((w) => w.trim()).filter(Boolean);
    setCustomDict(words);
    setDictSaved(true);
    setTimeout(() => setDictSaved(false), 1500);
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="设置" desc="AI 连接与关键词词典配置" />

      <Card className="mt-6">
        <CardHeader
          icon={<KeyRound size={15} />}
          title="AI 服务"
          extra={
            <span className="flex items-center gap-1.5 text-xs text-ink-400">
              <ShieldCheck size={12} />
              key 仅存本浏览器
            </span>
          }
        />
        <div className="space-y-4 p-5">
          <Field
            label="API Base URL"
            hint="兼容 OpenAI 协议即可，如 DeepSeek 填 https://api.deepseek.com/v1"
            error={urlInvalid ? "Base URL 含非 ASCII 字符，请检查" : undefined}
          >
            <Input value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
          </Field>
          <Field
            label="API Key"
            hint="分析时随任务传给本地后端，仅内存不落库"
            error={keyInvalid ? "key 混入了非 ASCII 字符，只保留 sk-... 那段" : undefined}
          >
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="模型">
              <Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="gpt-4o-mini" />
            </Field>
            <Field label="temperature">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={draft.temperature}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? 0 : Number(v);
                  // NaN 时保持原值，避免非法值进入状态
                  setDraft({ ...draft, temperature: Number.isFinite(n) ? n : draft.temperature });
                }}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" onClick={save} disabled={keyInvalid || urlInvalid}>
              {saved ? <Check size={15} /> : null}
              {saved ? "已保存" : "保存设置"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          icon={<BookMarked size={15} />}
          title="自定义关键词词典"
          extra={
            <span className="flex items-center gap-1.5 text-xs text-ink-400">
              <Check size={12} />
              词云统计生效
            </span>
          }
        />
        <div className="p-5">
          <Field
            label="自定义关键词（每行一个，或逗号分隔）"
            hint="添加产品名、特定槽点等词，评论中出现该词就会计入关键词云统计（与内置评价词典合并）"
          >
            <Textarea
              value={dictText}
              onChange={(e) => setDictText(e.target.value)}
              rows={6}
              placeholder={"例如：\n某产品名\n发货慢\n包装破损\n客服敷衍"}
            />
          </Field>
          <div className="mt-4">
            <Button variant="primary" onClick={saveDict}>
              {dictSaved ? <Check size={15} /> : null}
              {dictSaved ? "已保存" : "保存词典"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
