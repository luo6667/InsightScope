import { fileURLToPath } from "node:url";

/**
 * 运行配置集中读取。
 * NODE_ENV=production 时执行生产强校验（assertProductionConfig）：
 * 密钥、CORS、限流、Mock AI、访问口令必须显式配置，不满足直接拒绝启动，
 * 避免把「开发默认值」带到生产环境。
 */

export const isProd = process.env.NODE_ENV === "production";

export const PORT = Number(process.env.PORT ?? 5176);

/** CORS 白名单：逗号分隔；默认仅允许本地 dev 前后端 */
export const CORS_ORIGINS = (
  process.env.CORS_ORIGIN ?? "http://localhost:5175,http://localhost:5176"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** 写接口简单限流：次/分钟/IP（0 关闭） */
export const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 0);

/** Mock AI 开关：默认关闭，仅显式设 ENABLE_MOCK_AI=true 才启用（测试用） */
export const ENABLE_MOCK_AI = process.env.ENABLE_MOCK_AI === "true";

/**
 * 访问口令（Bearer token）：设置后所有 /api/* 与 socket.io 连接必须携带，
 * 否则返回 401。未设置 = 开发模式，不启用认证（启动时有警告）。
 */
export const ACCESS_TOKEN = (process.env.ACCESS_TOKEN ?? "").trim();

/** 是否要求访问口令（ACCESS_TOKEN 已设置 = 认证启用） */
export const authRequired = ACCESS_TOKEN.length > 0;

/** 前端构建产物目录（默认 ../web/dist） */
export const WEB_DIST =
  process.env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url));

/** 生产强校验：列出所有未满足项并退出，一条不漏 */
export function assertProductionConfig(): void {
  if (!isProd) return;
  const problems: string[] = [];
  if (!process.env.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD === "1234") {
    problems.push("MYSQL_PASSWORD 必须显式设置（禁止使用默认密码 1234）");
  }
  if (!process.env.CORS_ORIGIN) {
    problems.push("CORS_ORIGIN 必须设置（逗号分隔允许访问的前端域名）");
  }
  if (!(RATE_LIMIT_PER_MIN > 0)) {
    problems.push("RATE_LIMIT_PER_MIN 必须大于 0（公网部署建议 60）");
  }
  if (ENABLE_MOCK_AI) {
    problems.push("ENABLE_MOCK_AI 必须为 false（生产禁止开启 Mock AI 端点）");
  }
  if (!ACCESS_TOKEN) {
    problems.push("ACCESS_TOKEN 必须设置（访问口令，所有 /api 与 socket 连接凭此鉴权）");
  } else if (ACCESS_TOKEN.length < 16) {
    problems.push("ACCESS_TOKEN 长度必须 ≥ 16 位（防暴力破解，建议随机串）");
  }
  if (problems.length > 0) {
    console.error(
      "\n[config] NODE_ENV=production 生产配置校验未通过，拒绝启动：\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\n"
    );
    process.exit(1);
  }
}
