import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, X } from "lucide-react";
import { updateComment } from "../api/api";
import { Badge, Button, Input } from "./ui";
import type { CommentRow } from "../api/types";

interface Props {
  datasetId: string;
  comment: CommentRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const sentimentOptions = [
  { value: "pos", label: "正面", cls: "text-emerald-400 border-emerald-800" },
  { value: "neu", label: "中性", cls: "text-sky-400 border-sky-800" },
  { value: "neg", label: "负面", cls: "text-red-400 border-red-800" },
] as const;

export default function CommentModal({ datasetId, comment, onClose, onSaved }: Props) {
  const [sentiment, setSentiment] = useState<string>(comment?.sentiment ?? "neu");
  const [topicsText, setTopicsText] = useState(comment?.topics.join("、") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时清理延迟关闭定时器，避免卸载后仍触发 onSaved/onClose
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const save = async () => {
    if (!comment) return;
    setSaving(true);
    setError(null);
    try {
      await updateComment(datasetId, comment.id, {
        sentiment,
        topics: topicsText.split(/[、,，\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 5),
      });
      setSaved(true);
      closeTimer.current = setTimeout(() => {
        onSaved();
        onClose();
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {comment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-ink-100">
                <Pencil size={15} className="text-accent-400" />
                评论详情
              </div>
              <button onClick={onClose} className="text-ink-400 hover:text-ink-100">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950 p-4">
              <p className="text-[15px] leading-relaxed text-ink-100">{comment.content}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
                <span>{comment.author}</span>
                <span>·</span>
                <span>{comment.platform}</span>
                <span className="ml-auto tabular-nums">{new Date(comment.timestamp).toLocaleString("zh-CN")}</span>
              </div>
              {comment.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {comment.keywords.map((k) => (
                    <Badge key={k}>{k}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-[13px] font-medium text-ink-300">手动修正情感</div>
              <div className="flex gap-2">
                {sentimentOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setSentiment(o.value)}
                    className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                      sentiment === o.value ? `${o.cls} bg-ink-800` : "border-ink-700 text-ink-400 hover:text-ink-200"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-[13px] font-medium text-ink-300">主题（顿号分隔）</div>
              <Input value={topicsText} onChange={(e) => setTopicsText(e.target.value)} placeholder="如：闪退、性能" />
            </div>

            {error && <div className="mt-2 text-xs text-red-400">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saved ? <Check size={14} /> : null}
                {saved ? "已保存" : "保存修正"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
