import type { AiConfig } from "../store/settings";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** 前端直连 AI 服务商（OpenAI / DeepSeek 兼容协议），SSE 流式输出 */
export async function streamChat(
  cfg: AiConfig,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const base = cfg.baseUrl.trim().replace(/\/+$/, "");
  const key = cfg.apiKey.trim().replace(/\s+/g, "");
  if (!key) throw new Error("请先在「设置」中填入 API key");
  if (!base) throw new Error("请先在「设置」中填写 Base URL");
  if (!/^https?:\/\//i.test(base)) {
    throw new Error("Base URL 需以 http(s):// 开头（如 https://api.openai.com/v1）");
  }
  if (!/^[\x20-\x7e]+$/.test(key)) {
    throw new Error("API key 包含非 ASCII 字符（可能复制带了多余文字/换行），请重新粘贴纯 key");
  }
  if (!/^[\x20-\x7e]+$/.test(base)) {
    throw new Error("Base URL 包含非 ASCII 字符，请检查");
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: cfg.model.trim(),
      messages,
      stream: true,
      temperature: cfg.temperature,
      max_tokens: 2000,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI 请求失败（${res.status}）：${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const delta = j.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return full;
}
