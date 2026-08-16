// 自定义关键词词典（存 localStorage，词云统计时传给后端合并匹配）
const KEY = "insight-custom-dict";

export function getCustomDict(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    return Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function setCustomDict(words: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(words.map((s) => s.trim()).filter(Boolean)));
}

/** 用于 queryKey 的稳定串 */
export function customDictKey(): string {
  return getCustomDict().join(",");
}
