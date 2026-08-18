// 实时监控链路自测：socket 监听 + 模拟器 + 告警规则触发
// 运行：cd insight\web && node scripts/sim-test.mjs
import { io } from "socket.io-client";

const base = "http://localhost:5176";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN ?? "";
// 后端启用访问口令时需携带
const authHeaders = ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {};

async function api(path, opts) {
  const res = await fetch(base + path, {
    headers: { "Content-Type": "application/json", ...authHeaders },
    ...opts,
  });
  return res.json();
}

// 建一个纯负面评论的小数据集，快速验证告警触发
const negBody = {
  comments: Array.from({ length: 12 }, (_, i) => ({
    content: `闪退问题太严重了，第${i + 1}次崩溃，根本无法正常使用`,
    sentiment: "neg",
    sentimentScore: -0.8,
    topics: ["闪退"],
    analyzed: true,
  })),
  name: "告警测试-纯负面",
};
const negDs = await api("/api/datasets", { method: "POST", body: JSON.stringify(negBody) });
console.log("negative dataset:", negDs.id, "count:", negDs.count);

// 清掉旧规则，给测试集加负面率 40% 规则
for (const r of (await api("/api/alerts/rules?dataset=" + negDs.id)).rules ?? []) {
  await api(`/api/alerts/rules/${r.id}`, { method: "DELETE" });
}
await api("/api/alerts/rules", {
  method: "POST",
  body: JSON.stringify({ datasetId: negDs.id, type: "negativity", threshold: 40 }),
});
console.log("rule added: negativity >= 40%");

const socket = io(base, { transports: ["websocket"], auth: { token: ACCESS_TOKEN } });
await new Promise((r) => socket.on("connect", r));
socket.emit("join-dataset", negDs.id);

let comments = 0;
let alerts = 0;
const alertMsgs = [];
socket.on("comment:stream", () => comments++);
socket.on("alert:new", (a) => {
  alerts++;
  alertMsgs.push(`[${a.severity}] ${a.message}`);
});
socket.on("sim:status", (s) => console.log("sim:status ->", JSON.stringify(s)));

const start = await api(`/api/datasets/${negDs.id}/simulate/start`, {
  method: "POST",
  body: JSON.stringify({ speed: 20 }),
});
console.log("simulate started:", JSON.stringify(start));

await new Promise((r) => setTimeout(r, 6000));

await api(`/api/datasets/${negDs.id}/simulate/stop`, { method: "POST" });
socket.disconnect();
// 清理测试数据集
await api(`/api/datasets/${negDs.id}`, { method: "DELETE" });

console.log("\n=== 结果 ===");
console.log("收到的实时评论:", comments);
console.log("收到的告警:", alerts);
alertMsgs.forEach((m) => console.log(" -", m));

const pass = comments >= 10 && alerts >= 1;
console.log(pass ? "PASS ✅" : "FAIL ❌");
process.exit(pass ? 0 : 1);
