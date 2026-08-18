import axios from "axios";
import { getAccessToken, notifyUnauthorized } from "../lib/auth";

export const http = axios.create({
  // 生产部署到独立 API 域名时用 VITE_API_BASE 覆盖；默认同源 /api
  baseURL: import.meta.env.VITE_API_BASE ?? "/api",
  timeout: 30000,
});

// 请求拦截：携带访问口令（后端未启用认证时多余的头无害）
http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 = 访问口令缺失/错误：通知全局弹出口令输入
    if (err.response?.status === 401) notifyUnauthorized();
    const msg =
      err.response?.data?.error ??
      (err.code === "ECONNABORTED" ? "请求超时" : err.message ?? "网络错误");
    return Promise.reject(new Error(msg));
  }
);

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await http.get<T>(url, { params });
  return data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.post<T>(url, body);
  return data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.patch<T>(url, body);
  return data;
}

export async function del<T>(url: string): Promise<T> {
  const { data } = await http.delete<T>(url);
  return data;
}
