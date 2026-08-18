// 舆情雷达全链路 e2e：REST + socket 覆盖所有功能
// 运行：cd insight\web && node scripts/e2e-test.mjs
import { io } from "socket.io-client";

const base = "http://localhost:5176";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? "";
// 后端启用访问口令时（ACCESS_TOKEN 已设置），所有请求与 socket 连接需携带
const authHeaders = ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {};

const results = [];
let failCount = 0;

function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) failCount++;
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? "  " + extra : ""}`);
}

async function api(path, opts) {
  const res = await fetch(base + path, {
    headers: { "Content-Type": "application/json", ...authHeaders },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// 1. 场景列表
const scenes = await api("/api/scenarios");
check("场景列表 = 3", scenes.data.scenarios?.length === 3, `count=${scenes.data.scenarios?.length}`);

// 2. 创建内置场景数据集
const created = await api("/api/datasets", {
  method: "POST",
  body: JSON.stringify({ scenarioId: "app-update" }),
});
const dsId = created.data.id;
check("创建内置场景", created.status === 201 && created.data.count === 450, `count=${created.data.count}`);

// 3. 数据集列表
const dsList = await api("/api/datasets");
const found = dsList.data.datasets?.find((d) => d.id === dsId);
check("数据集列表包含新场景", !!found, `comments=${found?.commentCount}`);

// 4. 评论分页 + 过滤
const page = await api(`/api/datasets/${dsId}/comments?page=1&limit=10`);
check("评论分页", page.data.total === 450 && page.data.comments?.length === 10, `total=${page.data.total}`);
const neg = await api(`/api/datasets/${dsId}/comments?limit=5&sentiment=neg`);
check("情感过滤 neg", neg.data.comments?.length >= 1 && neg.data.comments.every((c) => c.sentiment === "neg"));
const topic = await api(`/api/datasets/${dsId}/comments?limit=5&topic=${encodeURIComponent("闪退")}`);
check("主题过滤 闪退", topic.status === 200);
const q = await api(`/api/datasets/${dsId}/comments?limit=5&q=${encodeURIComponent("更新")}`);
check("关键词搜索 更新", q.data.comments?.length >= 1);

// 5. 统计
const stats = await api(`/api/datasets/${dsId}/stats`);
const s = stats.data;
check(
  "统计完整性",
  s.total === 450 &&
    s.sentiment.pos + s.sentiment.neu + s.sentiment.neg === 450 &&
    s.topics.length > 0 &&
    s.keywords.length > 0 &&
    s.trend.length > 0,
  `pos=${s.sentiment?.pos} neg=${s.sentiment?.neg} topics=${s.topics?.length} trend=${s.trend?.length}`
);

// 6. 告警规则 CRUD（三种类型）：保留 negativity 规则用于模拟器告警测试
const r1 = await api("/api/alerts/rules", { method: "POST", body: JSON.stringify({ datasetId: dsId, type: "negativity", threshold: 30 }) });
const r2 = await api("/api/alerts/rules", { method: "POST", body: JSON.stringify({ datasetId: dsId, type: "keyword", threshold: 1, keyword: "闪退" }) });
const r3 = await api("/api/alerts/rules", { method: "POST", body: JSON.stringify({ datasetId: dsId, type: "volume", threshold: 20 }) });
check("创建三种规则", r1.status === 201 && r2.status === 201 && r3.status === 201);
const rulesList = await api(`/api/alerts/rules?dataset=${dsId}`);
check("规则列表(所有规则) >= 3", rulesList.data.rules?.length >= 3, `count=${rulesList.data.rules?.length}`);
const upd = await api(`/api/alerts/rules/${r3.data.id}`, { method: "PATCH", body: JSON.stringify({ enabled: false }) });
check("停用 volume 规则", upd.data.ok === true);
await api(`/api/alerts/rules/${r3.data.id}`, { method: "DELETE" });
const rulesList2 = await api(`/api/alerts/rules?dataset=${dsId}`);
check("删除后 >= 2", rulesList2.data.rules?.length >= 2, `count=${rulesList2.data.rules?.length}`);

// 7. socket 实时模拟 + 告警触发
const socket = io(base, { transports: ["websocket"], auth: { token: ACCESS_TOKEN } });
await new Promise((r) => socket.on("connect", r));
socket.emit("join-dataset", dsId);
let comments = 0;
let alerts = 0;
socket.on("comment:stream", () => comments++);
socket.on("alert:new", () => alerts++);
const simStart = await api(`/api/datasets/${dsId}/simulate/start`, { method: "POST", body: JSON.stringify({ speed: 20 }) });
check("模拟器启动", simStart.data.ok === true, `total=${simStart.data.total}`);
await new Promise((r) => setTimeout(r, 15000));
await api(`/api/datasets/${dsId}/simulate/stop`, { method: "POST" });
await new Promise((r) => setTimeout(r, 400));
check("模拟器推送评论", comments > 100, `received=${comments}`);
check("告警触发（负面激增段）", alerts >= 1, `alerts=${alerts}`);

// 8. 告警列表 + 确认
const alertList = await api(`/api/alerts?dataset=${dsId}`);
check("告警列表", alertList.data.alerts?.length >= 1);
if (alertList.data.alerts?.length > 0) {
  const ack = await api(`/api/alerts/${alertList.data.alerts[0].id}/ack`, { method: "PATCH" });
  check("告警确认", ack.data.ok === true);
}

// 9. 分析任务（假 key：应不崩，任务结束为 failed 或 done）
const jobStart = await api(`/api/datasets/${dsId}/analysis`, {
  method: "POST",
  body: JSON.stringify({ apiKey: "sk-invalid-test-key", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", concurrency: 4 }),
});
check("创建分析任务", jobStart.status === 201 || jobStart.data.job?.id, `status=${jobStart.status}`);
await new Promise((r) => setTimeout(r, 5000));
const jobGet = await api(`/api/datasets/${dsId}/analysis`);
const job = jobGet.data.job;
check(
  "任务状态合法（不崩）",
  !!job && ["pending", "running", "paused", "done", "failed"].includes(job.status),
  `status=${job?.status} processed=${job?.processed} failed=${job?.failed}`
);

// 10. 粘贴导入 + 删除
const paste = await api("/api/datasets", {
  method: "POST",
  body: JSON.stringify({
    name: "e2e 粘贴测试",
    comments: [
      { content: "服务很好" },
      { content: "物流太慢了" },
      { content: "产品不错，下次还买" },
      { content: "客服响应很快" },
    ],
  }),
});
check("粘贴导入", paste.status === 201 && paste.data.count === 4, `status=${paste.status} count=${paste.data.count}`);
const pasteStats = await api(`/api/datasets/${paste.data.id}/stats`);
check("粘贴数据统计", pasteStats.data.total === 4);
const delPaste = await api(`/api/datasets/${paste.data.id}`, { method: "DELETE" });
check("删除粘贴数据集", delPaste.data.ok === true);

// 11. 删除内置场景数据集（级联）
const delMain = await api(`/api/datasets/${dsId}`, { method: "DELETE" });
check("删除主数据集", delMain.data.ok === true);
const afterDel = await api(`/api/datasets/${dsId}/stats`);
check("级联后统计为空", afterDel.status === 200 && afterDel.data.total === 0, `total=${afterDel.data.total}`);

socket.disconnect();

console.log(`\n===== ${results.length - failCount}/${results.length} 通过 =====`);
process.exit(failCount === 0 ? 0 : 1);
