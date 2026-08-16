import { useEffect } from "react";
import { getSocket } from "../lib/socket";

/**
 * 统一的数据集 socket 监听：
 * - join 当前数据集房间（含断线重连后重新 join，socket.io 重连是新连接、房间成员已清空）
 * - 订阅事件，卸载时自动 off + leave
 * 供监控台（实时评论/告警/模拟状态）与分析页（进度推送）复用。
 */
export function useDatasetSocket(
  datasetId: string,
  handlers: Record<string, (...args: unknown[]) => void>
) {
  useEffect(() => {
    if (!datasetId) return;
    const socket = getSocket();
    const join = () => socket.emit("join-dataset", datasetId);
    join();
    // 重连后重新加入房间，否则实时推送静默丢失
    socket.on("connect", join);
    for (const [event, fn] of Object.entries(handlers)) {
      socket.on(event, fn as never);
    }
    return () => {
      socket.off("connect", join);
      for (const [event, fn] of Object.entries(handlers)) {
        socket.off(event, fn as never);
      }
      socket.emit("leave-dataset", datasetId);
    };
    // handlers 由稳定 setState 构成，仅依赖 datasetId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId]);
}
