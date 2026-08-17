import mysql from "mysql2/promise";
import { Sequelize } from "sequelize";

// MySQL 连接配置（默认 root/1234@127.0.0.1:3306，库名 plfx；可用环境变量覆盖）
export const DB_CONFIG = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "1234",
  database: process.env.MYSQL_DATABASE ?? "plfx",
};

export function dbUriSummary(): string {
  return `${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`;
}

/** 确保数据库存在（utf8mb4 支持中文与 emoji） */
async function ensureDatabase(): Promise<void> {
  const conn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    charset: "utf8mb4",
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

export const sequelize = new Sequelize(DB_CONFIG.database, DB_CONFIG.user, DB_CONFIG.password, {
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  dialect: "mysql",
  timezone: "+00:00", // 统一 UTC 存储（与原先 MongoDB 行为一致）
  logging: false,
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

/**
 * 幂等补充评论表去重唯一索引（模拟原 MongoDB partialFilterExpression：
 * 仅对 sourceId 非空的评论生效）。MySQL 无部分索引，用生成列实现——
 * sourceId 为空时生成 NULL（唯一索引允许多个 NULL），非空时取 sourceId。
 * 注：Sequelize 默认列名与属性名一致（camelCase，如 datasetId/sourceId）。
 */
async function ensureCommentDedupIndex(): Promise<void> {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'comments' AND index_name = 'uniq_dataset_source'`
  );
  const exists = Number((rows as { n: number }[])[0]?.n ?? 0) > 0;
  if (exists) return;
  await sequelize.query(`
    ALTER TABLE comments
      ADD COLUMN source_key VARCHAR(191) GENERATED ALWAYS AS (IF(sourceId = '', NULL, sourceId)) STORED,
      ADD UNIQUE INDEX uniq_dataset_source (datasetId, source_key)
  `);
}

/** 连接 MySQL + 建库建表 + 索引（应用启动时调用一次） */
export async function initDb(): Promise<void> {
  await ensureDatabase();
  await sequelize.authenticate();
  await sequelize.sync(); // 创建缺失的表（模型定义见 models.ts）
  await ensureCommentDedupIndex();
}
