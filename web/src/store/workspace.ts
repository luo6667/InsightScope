import { create } from "zustand";
import { persist } from "zustand/middleware";

// 全局工作区状态：当前数据集（监控台/分析/报告/告警中心 四页共享，切换页面保持）
interface WorkspaceState {
  datasetId: string;
  setDatasetId: (id: string) => void;
}

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      datasetId: "",
      setDatasetId: (id) => set({ datasetId: id }),
    }),
    { name: "insight-workspace" }
  )
);
