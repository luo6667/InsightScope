import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../store/workspace";

/**
 * 统一的"当前数据集"选择状态：
 * - URL ?dataset= 优先（从数据集页跳转带参）
 * - 否则用全局 store（跨页面保持）
 * - 选择器变更时同步 URL + store（保留其他查询参数）
 */
export function useCurrentDataset(): { datasetId: string; setDatasetId: (id: string) => void } {
  const [params, setParams] = useSearchParams();
  const urlDs = params.get("dataset") ?? "";
  const storeDs = useWorkspace((s) => s.datasetId);
  const setStoreDs = useWorkspace((s) => s.setDatasetId);

  // URL 带参（跳转）时同步进 store
  useEffect(() => {
    if (urlDs && urlDs !== storeDs) setStoreDs(urlDs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDs]);

  const datasetId = urlDs || storeDs;

  const setDatasetId = (id: string) => {
    setStoreDs(id);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("dataset", id);
        else next.delete("dataset");
        return next;
      },
      { replace: true }
    );
  };

  return { datasetId, setDatasetId };
}
