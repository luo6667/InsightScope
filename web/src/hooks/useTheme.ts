import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "insight-theme";

// 模块加载即先行设置 data-theme，避免首帧浅/深色闪烁（FOUC）
const initialTheme: Theme = (() => {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
})();
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = initialTheme;
}

/** 深浅主题：切换 data-theme + localStorage 记忆（App 布局与移动端 Tab 共用） */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
