import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN } from "../config.js";

/**
 * 简单访问口令认证（Bearer token）：
 * - 未设置 ACCESS_TOKEN（开发模式）→ 不启用认证，中间件直接放行；
 * - 已设置 → 所有请求必须携带 `Authorization: Bearer <token>`，
 *   校验用 timingSafeEqual 做常数时间比较，防时序侧信道。
 * 适用于单机/团队内部部署的轻量防护；如需多用户、角色权限，应换完整认证方案。
 */

export function authEnabled(): boolean {
  return ACCESS_TOKEN.length > 0;
}

/** 常数时间比较两个字符串是否相等（长度不同直接 false，避免 timingSafeEqual 抛错） */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyAccessToken(token: unknown): boolean {
  if (!authEnabled() || typeof token !== "string" || token.length === 0) return false;
  return safeEqual(token, ACCESS_TOKEN);
}

// 口令暴力破解防护：按 IP 计数失败，窗口内失败过多则锁定（期间一律 429，含正确口令）
// 内存实现，重启清零；单机部署够用。
const failBuckets = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILS = 10; // 每窗口最多失败次数
const LOCK_MS = 60_000; // 锁定窗口

export function requireAccessToken(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled()) return next();
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const bucket = failBuckets.get(ip);
  if (bucket && bucket.lockedUntil > now) {
    res.status(429).json({ error: "尝试次数过多，请稍后再试" });
    return;
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!verifyAccessToken(token)) {
    const nextBucket = { count: (bucket?.count ?? 0) + 1, lockedUntil: 0 };
    if (nextBucket.count >= MAX_FAILS) {
      nextBucket.count = 0;
      nextBucket.lockedUntil = now + LOCK_MS;
    }
    failBuckets.set(ip, nextBucket);
    res.status(401).json({ error: "未授权：需要访问口令（ACCESS_TOKEN）" });
    return;
  }
  failBuckets.delete(ip); // 校验成功清零
  next();
}

/** socket.io 握手校验：client 需在 auth.token 中携带口令，失败拒绝连接 */
export function socketAuthGuard(
  socket: { handshake: { auth?: { token?: unknown } } },
  next: (err?: Error) => void
): void {
  if (!authEnabled()) return next();
  if (verifyAccessToken(socket.handshake.auth?.token)) return next();
  next(new Error("unauthorized"));
}
