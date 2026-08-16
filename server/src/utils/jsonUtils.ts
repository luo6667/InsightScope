/** JSON 兜底解析：兼容代码块包裹 / 前后杂质，返回数组或对象 */

export function parseJsonArray(text: string): unknown[] | null {
  const candidates = [text.trim(), text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim()];
  for (const c of candidates) {
    try {
      const v = JSON.parse(c) as unknown;
      if (Array.isArray(v)) return v;
    } catch {
      /* next */
    }
  }
  const mArr = text.match(/\[[\s\S]*\]/);
  if (mArr) {
    try {
      const v = JSON.parse(mArr[0]) as unknown;
      if (Array.isArray(v)) return v;
    } catch {
      /* ignore */
    }
  }
  const mObj = text.match(/\{[\s\S]*\}/);
  if (mObj) {
    try {
      const v = JSON.parse(mObj[0]);
      if (v && typeof v === "object") return [v];
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const arr = parseJsonArray(text);
  const obj = arr?.[0];
  return typeof obj === "object" && obj !== null ? (obj as Record<string, unknown>) : null;
}
