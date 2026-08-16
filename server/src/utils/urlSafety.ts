import { isIP } from "node:net";
import { HttpError } from "./httpUtils.js";

/**
 * SSRF 防护：校验用户提供的 URL 只允许公网 http/https，
 * 拒绝内网/环回/链路本地/云元数据地址，防止服务器被当作代理扫描内网。
 * 返回去除尾部斜杠的规范化 URL；非法时抛 HttpError(400)。
 */
export function assertPublicHttpUrl(raw: unknown, field = "URL"): string {
  const s = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!s) throw new HttpError(400, `${field}不能为空`);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new HttpError(400, `${field}格式无效`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new HttpError(400, `${field}仅支持 http/https`);
  }
  if (u.username || u.password) {
    throw new HttpError(400, `${field}不允许包含用户名/密码`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  // 域名形式的内网别名
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new HttpError(400, `${field}不允许访问本地/内网地址`);
  }
  if (isIP(host) !== 0 && isPrivateAddress(host)) {
    throw new HttpError(400, `${field}不允许访问私网/内网地址`);
  }
  return s;
}

/** 判断 IP 字面量是否属于私网/保留/链路本地/云元数据段 */
function isPrivateAddress(host: string): boolean {
  if (host.includes(".")) {
    const parts = host.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
    const [a, b] = parts;
    return (
      a === 10 || // 10/8
      a === 127 || // 127/8 环回
      (a === 169 && b === 254) || // 169.254/16 链路本地（含云元数据）
      (a === 172 && b >= 16 && b <= 31) || // 172.16/12
      (a === 192 && b === 168) || // 192.168/16
      a === 0 || // 0/8
      (a === 100 && b >= 64 && b <= 127) // 100.64/10 CGNAT
    );
  }
  const h = host.toLowerCase();
  // IPv4-mapped IPv6（::ffff:1.2.3.4）
  if (h.startsWith("::ffff:")) return isPrivateAddress(h.slice(7));
  return (
    h === "::" ||
    h === "::1" || // 环回
    h.startsWith("fc") || // fc00::/7 ULA
    h.startsWith("fd") ||
    h.startsWith("fe8") || // fe80::/10 链路本地
    h.startsWith("fe9") ||
    h.startsWith("fea") ||
    h.startsWith("feb")
  );
}
