import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Bell, BrainCircuit, Database, FileText, Gauge, Loader2, Moon, Radar, Settings, Sun, Upload } from "lucide-react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";

// 路由级懒加载：按需加载页面，减小首屏 bundle
const DatasetsPage = lazy(() => import("./pages/DatasetsPage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const AlertCenterPage = lazy(() => import("./pages/AlertCenterPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

interface NavItem {
  to: string;
  label: string;
  icon: typeof Database;
  mobile?: boolean;
}

/** lazy 路由的加载占位（防止无 Suspense 边界导致白屏崩溃） */
function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-400">
      <Loader2 size={16} className="mr-2 animate-spin" />
      加载中…
    </div>
  );
}

const nav: NavItem[] = [
  { to: "/datasets", label: "数据集", icon: Database, mobile: true },
  { to: "/import", label: "导入数据", icon: Upload },
  { to: "/dashboard", label: "监控台", icon: Gauge, mobile: true },
  { to: "/analysis", label: "智能分析", icon: BrainCircuit, mobile: true },
  { to: "/reports", label: "舆情报告", icon: FileText, mobile: true },
  { to: "/alerts", label: "告警中心", icon: Bell, mobile: true },
];

function IslandItem({ item, onNav }: { item: NavItem; onNav?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} className="block" onClick={onNav}>
      {({ isActive }) => (
        <span
          className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-150 ${
            isActive
              ? "bg-accent-500/12 font-medium text-accent-300"
              : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-200"
          }`}
        >
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-400"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <Icon size={17} strokeWidth={2} className="shrink-0" />
          <span>{item.label}</span>
        </span>
      )}
    </NavLink>
  );
}

export default function App() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-[100dvh]">
      {/* 桌面悬浮岛（lg 以上） */}
      <nav className="island-glass fixed left-6 top-1/2 z-50 hidden w-56 -translate-y-1/2 rounded-3xl py-5 lg:block">
        <div className="mb-3 flex items-center gap-3 border-b border-ink-800/80 px-4 pb-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-accent-950 shadow-[0_4px_14px_-4px_rgba(245,158,11,0.55)]">
            <Radar size={18} strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight text-ink-100">舆情雷达</div>
            <div className="text-[11.5px] text-ink-400">InsightScope</div>
          </div>
        </div>

        <div className="px-2.5 pb-1.5 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          数据
        </div>
        <div className="space-y-1 px-2.5">
          <IslandItem item={nav[0]} />
          <IslandItem item={nav[1]} />
        </div>

        <div className="px-2.5 pb-1.5 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          洞察
        </div>
        <div className="space-y-1 px-2.5">
          {nav.slice(2).map((n) => (
            <IslandItem key={n.to} item={n} />
          ))}
        </div>

        <div className="mt-4 border-t border-ink-800/80 px-2.5 pt-3">
          <div className="flex items-center gap-1.5">
            <NavLink to="/settings" className="flex-1">
              {({ isActive }) => (
                <span
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-150 ${
                    isActive
                      ? "bg-accent-500/12 font-medium text-accent-300"
                      : "text-ink-400 hover:bg-ink-800/60 hover:text-ink-200"
                  }`}
                >
                  <Settings size={17} strokeWidth={2} />
                  设置
                </span>
              )}
            </NavLink>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "切换浅色" : "切换深色"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700 text-ink-400 transition-colors hover:text-accent-400"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </nav>

      {/* 移动端底部 Tab（lg 以下） */}
      <nav className="island-glass fixed bottom-3 left-3 right-3 z-50 rounded-2xl px-2 py-2 lg:hidden">
        <div className="flex items-center justify-around">
          {nav.filter((n) => n.mobile).map((n) => {
            const Icon = n.icon;
            return (
              <NavLink key={n.to} to={n.to}>
                {({ isActive }) => (
                  <span className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] ${isActive ? "text-accent-400" : "text-ink-400"}`}>
                    <Icon size={18} strokeWidth={2} />
                    {n.label}
                  </span>
                )}
              </NavLink>
            );
          })}
          <button onClick={toggleTheme} className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] text-ink-400">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            主题
          </button>
        </div>
      </nav>

      {/* 内容区 */}
      <main className="px-4 pb-24 pt-2 sm:px-6 lg:pl-28 lg:pb-6">
        <Suspense fallback={<PageLoading />}>
          <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/datasets" replace />} />
              <Route path="/datasets" element={<DatasetsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/alerts" element={<AlertCenterPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/datasets" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
}
