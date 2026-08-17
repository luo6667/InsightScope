// 把指定数据集的评论重置为未分析状态，并清理该数据集的分析任务（演示 AI 分析全流程用）
// 运行：cd insight/server && npx tsx reset-analysis.ts [数据集名关键词]
import { Op } from "sequelize";
import { initDb } from "./src/db.js";
import { DatasetModel, AnalysisJobModel, CommentModel } from "./src/models.js";

const keyword = process.argv[2] ?? "大版本";

async function main() {
  await initDb();
  const ds = await DatasetModel.findOne({ where: { name: { [Op.like]: `%${keyword}%` } } });
  if (!ds) {
    console.log(`未找到名称包含「${keyword}」的数据集`);
    process.exit(1);
  }
  await AnalysisJobModel.destroy({ where: { datasetId: ds.id } });
  const [affected] = await CommentModel.update(
    { analyzed: false, sentiment: "neu", sentimentScore: 0, topics: [], keywords: [] },
    { where: { datasetId: ds.id } }
  );
  console.log(`重置完成：数据集[${ds.name}] 共 ${affected} 条评论 -> analyzed=false（已清理分析任务）`);
  process.exit(0);
}

void main();
