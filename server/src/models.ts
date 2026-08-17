import { DataTypes, literal, Model, type CreationOptional } from "sequelize";
import { sequelize } from "./db.js";

// MySQL 模型（属性名与原 Mongoose 字段一致；id 为自增整数但对外统一返回字符串，
// 与原 ObjectId 字符串行为兼容；topics/keywords 使用 MySQL JSON 列存储数组）

export class Dataset extends Model {
  declare id: CreationOptional<string>; // getter 返回字符串
  declare name: string;
  declare platform: string;
  declare type: string;
  declare scenarioId: string;
  declare feedUrl: string;
  declare feedIntervalMin: number;
  declare feedRunning: boolean;
  declare feedLastAt: Date | null;
  declare feedLastCount: number;
  declare feedLastError: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
Dataset.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      get() {
        return String(this.getDataValue("id"));
      },
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    platform: { type: DataTypes.STRING(64), defaultValue: "混合来源" },
    type: { type: DataTypes.STRING(16), defaultValue: "imported" }, // builtin | imported | feed
    scenarioId: { type: DataTypes.STRING(64), defaultValue: "" },
    // URL 定时抓取
    feedUrl: { type: DataTypes.STRING(2048), defaultValue: "" },
    feedIntervalMin: { type: DataTypes.INTEGER, defaultValue: 0 },
    feedRunning: { type: DataTypes.BOOLEAN, defaultValue: false },
    feedLastAt: { type: DataTypes.DATE(3), defaultValue: null },
    feedLastCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    feedLastError: { type: DataTypes.STRING(500), defaultValue: "" },
  },
  { sequelize, tableName: "datasets", timestamps: true }
);

export class Comment extends Model {
  declare id: CreationOptional<string>;
  declare datasetId: string;
  declare content: string;
  declare author: string;
  declare platform: string;
  declare timestamp: CreationOptional<Date>;
  declare sentiment: string;
  declare sentimentScore: number;
  declare topics: string[];
  declare keywords: string[];
  declare analyzed: boolean;
  declare sourceId: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
Comment.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      get() {
        return String(this.getDataValue("id"));
      },
    },
    datasetId: { type: DataTypes.STRING(32), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    author: { type: DataTypes.STRING(64), defaultValue: "匿名用户" },
    platform: { type: DataTypes.STRING(64), defaultValue: "未知" },
    timestamp: { type: DataTypes.DATE(3), defaultValue: DataTypes.NOW },
    sentiment: { type: DataTypes.STRING(8), defaultValue: "neu" }, // pos | neu | neg
    sentimentScore: { type: DataTypes.FLOAT, defaultValue: 0 },
    topics: { type: DataTypes.JSON, defaultValue: literal("('[]')") },
    keywords: { type: DataTypes.JSON, defaultValue: literal("('[]')") },
    analyzed: { type: DataTypes.BOOLEAN, defaultValue: false },
    // 数据源原始 ID：仅当抓取接口提供 id 时按它去重（同一条评论不重复抓）
    sourceId: { type: DataTypes.STRING(191), defaultValue: "" },
  },
  {
    sequelize,
    tableName: "comments",
    timestamps: true,
    indexes: [
      { fields: ["datasetId", "timestamp"] },
      { fields: ["timestamp"] },
    ],
  }
);

export class AnalysisJob extends Model {
  declare id: CreationOptional<string>;
  declare datasetId: string;
  declare status: string;
  declare total: number;
  declare processed: number;
  declare failed: number;
  declare concurrency: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
AnalysisJob.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      get() {
        return String(this.getDataValue("id"));
      },
    },
    datasetId: { type: DataTypes.STRING(32), allowNull: false },
    status: { type: DataTypes.STRING(10), defaultValue: "pending" }, // pending | running | paused | done | failed
    total: { type: DataTypes.INTEGER, defaultValue: 0 },
    processed: { type: DataTypes.INTEGER, defaultValue: 0 },
    failed: { type: DataTypes.INTEGER, defaultValue: 0 },
    concurrency: { type: DataTypes.INTEGER, defaultValue: 4 },
  },
  { sequelize, tableName: "analysis_jobs", timestamps: true, indexes: [{ fields: ["datasetId"] }] }
);

export class AlertRule extends Model {
  declare id: CreationOptional<string>;
  declare datasetId: string;
  declare type: string;
  declare threshold: number;
  declare keyword: string;
  declare enabled: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
AlertRule.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      get() {
        return String(this.getDataValue("id"));
      },
    },
    datasetId: { type: DataTypes.STRING(32), allowNull: false },
    type: { type: DataTypes.STRING(12), allowNull: false }, // negativity | volume | keyword
    threshold: { type: DataTypes.DOUBLE, allowNull: false },
    keyword: { type: DataTypes.STRING(255), defaultValue: "" },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, tableName: "alert_rules", timestamps: true, indexes: [{ fields: ["datasetId"] }] }
);

export class Alert extends Model {
  declare id: CreationOptional<string>;
  declare datasetId: string;
  declare type: string;
  declare severity: string;
  declare message: string;
  declare value: number;
  declare triggeredAt: CreationOptional<Date>;
  declare acknowledged: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
Alert.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      get() {
        return String(this.getDataValue("id"));
      },
    },
    datasetId: { type: DataTypes.STRING(32), allowNull: false },
    type: { type: DataTypes.STRING(12), allowNull: false }, // negativity | volume | keyword
    severity: { type: DataTypes.STRING(10), defaultValue: "warning" }, // critical | warning | info
    message: { type: DataTypes.TEXT, allowNull: false },
    value: { type: DataTypes.DOUBLE, defaultValue: 0 },
    triggeredAt: { type: DataTypes.DATE(3), defaultValue: DataTypes.NOW },
    acknowledged: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, tableName: "alerts", timestamps: true, indexes: [{ fields: ["datasetId"] }] }
);

export const DatasetModel = Dataset;
export const CommentModel = Comment;
export const AnalysisJobModel = AnalysisJob;
export const AlertRuleModel = AlertRule;
export const AlertModel = Alert;
