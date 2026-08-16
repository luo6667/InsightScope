import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // 生产部署到独立域名时用 VITE_SOCKET_URL 覆盖；默认同源
    socket = io(import.meta.env.VITE_SOCKET_URL ?? "/", { transports: ["websocket", "polling"] });
  }
  return socket;
}
