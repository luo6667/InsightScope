import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Field, Input } from "./ui";
import { getAccessToken, setAccessToken, UNAUTHORIZED_EVENT } from "../lib/auth";
import { refreshSocketAuth } from "../lib/socket";

/**
 * 访问口令门禁：
 * - 启动时探测 GET /api/auth/status：后端未启用认证（开发模式）→ 直接放行；
 * - 已启用且无口令 → 全屏弹层要求输入 ACCESS_TOKEN；
 * - 任一 API 返回 401 或 socket 握手被拒（unauthorized）→ 弹层要求重新输入；
 * - 提交后用真实请求验证口令，通过才解锁并刷新数据。
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

type GateState = "checking" | "locked" | "open";

export default function AccessGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [gate, setGate] = useState<GateState>("checking");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 启动探测：后端是否要求口令
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/status`);
        const data = (await res.json()) as { authRequired?: boolean };
        if (cancelled) return;
        if (data.authRequired && !getAccessToken()) setGate("locked");
        else setGate("open");
      } catch {
        // 探测失败（后端未启动等）：先放行，让页面自身报错
        if (!cancelled) setGate("open");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 401 / socket 拒绝 → 锁定
  useEffect(() => {
    const onUnauthorized = () => setGate("locked");
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = token.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    try {
      // 用真实受保护请求验证口令
      const res = await fetch(`${API_BASE}/scenarios`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        setError("口令不正确，请重试");
        return;
      }
      if (!res.ok) {
        setError("服务器响应异常，请稍后重试");
        return;
      }
      setAccessToken(t);
      refreshSocketAuth(); // 用新口令重连 socket
      queryClient.invalidateQueries(); // 刷新所有已失败的数据
      setGate("open");
    } catch {
      setError("无法连接服务器，请检查网络");
    } finally {
      setBusy(false);
    }
  };

  if (gate === "checking") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/90">
        <Loader2 size={22} className="animate-spin text-ink-400" />
      </div>
    );
  }

  if (gate === "open") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/90 px-6">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
            <Lock size={18} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-ink-100">需要访问口令</div>
            <div className="text-xs text-ink-400">请输入管理员提供的访问口令（ACCESS_TOKEN）</div>
          </div>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="访问口令">
            <div className="relative">
              <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <Input
                type="password"
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="输入口令"
                className="pl-9"
              />
            </div>
          </Field>
          {error && <div className="text-[13px] text-red-400">{error}</div>}
          <Button variant="primary" className="w-full" disabled={!token.trim() || busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            {busy ? "验证中…" : "进入系统"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
