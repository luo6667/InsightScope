// 把指定数据集的评论重置为未分析状态，并清理该数据集的分析任务（演示 AI 分析全流程用）
// 运行：cd insight/server && npx tsx reset-analysis.ts [数据集名关键词]
import mongoose from "mongoose";

const keyword = process.argv[2] ?? "大版本";

async function main() {
  await mongoose.connect("mongodb://root:1234@127.0.0.1:27017/insight?authSource=admin");
  const ds = await mongoose.connection.db.collection("datasets").findOne({ name: new RegExp(keyword) });
  if (!ds) {
    console.log(`未找到名称包含「${keyword}」的数据集`);
    process.exit(1);
  }
  await mongoose.connection.db.collection("analysisjobs").deleteMany({ datasetId: ds._id });
  const r = await mongoose.connection.db.collection("comments").updateMany(
    { datasetId: ds._id },
    { $set: { analyzed: false, sentiment: "neu", sentimentScore: 0, topics: [], keywords: [] } }
  );
  console.log(`重置完成：数据集[${ds.name}] 共 ${r.modifiedCount} 条评论 -> analyzed=false（已清理分析任务）`);
  await mongoose.disconnect();
}

void main();
