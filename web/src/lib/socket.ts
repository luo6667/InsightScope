import { io, type Socket } from "socket.io-client";
import { getAccessToken, notifyUnauthorized } from "./auth";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // 生产部署到独立域名时用 VITE_SOCKET_URL 覆盖；默认同源
    socket = io(import.meta.env.VITE_SOCKET_URL ?? "/", {
      transports: ["websocket", "polling"],
      // 握手携带访问口令（后端 ACCESS_TOKEN 启用时校验，未启用则忽略）
      auth: { token: getAccessToken() },
    });
    // 口令错误被拒：通知全局弹出口令输入
    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized") notifyUnauthorized();
    });
  }
  return socket;
}

/** 访问口令变化后调用：更新握手凭据并重连（socket.io 重连是新连接） */
export function refreshSocketAuth(): void {
  if (!socket) return;
  socket.auth = { token: getAccessToken() };
  if (socket.connected) socket.disconnect();
  socket.connect();
}
