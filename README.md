# 舆情雷达 InsightScope · AI 用户评论分析与舆情监控平台

一个前端为主的 AI 全栈项目：把散落的用户评论变成「**可导入 → 可分析 → 可监控 → 可告警 → 可报告**」的舆情雷达。
内置 3 个舆情场景（预标注，**免 API key 即可完整演示**），实时模拟器让监控台"活"起来。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite · React 19 · TypeScript · Tailwind CSS 4 · **react-router** · **axios** · Zustand · TanStack Query · **ECharts**（含词云）· socket.io-client |
| 后端 | Express · Mongoose (MongoDB) · **socket.io** · axios（AI 调用） |
| AI | OpenAI 兼容 `/chat/completions`（OpenAI / DeepSeek 均可），自插 key |
| 算法 | 滑动窗口 Z-score 异常检测 · MongoDB 聚合管道 |

## 功能

- **采集**：3 个内置舆情场景（App 更新/新品发布/公关危机，共 1300+ 条真实格式评论）、粘贴导入、按时间轴实时模拟器（1x-20x 加速）
- **分析**：AI 批量分析队列（并发限流 1-8 / 断点续跑 / 失败重试 / WebSocket 进度推送），输出情感 / 主题 / 关键词，可暂停恢复取消
- **监控**：仪表盘四图（情感环形图 / 按天趋势 / 热门主题 / 关键词云）+ 统计卡片 + 最近评论
- **实时**：模拟器重放评论流入（流入动画）、告警实时弹出（socket 推送）
- **告警**：规则配置（负面率阈值 / 评论量 / 敏感关键词）+ Z-score 负面率异常检测 + 60s 冷却 + 告警确认流转
- **报告**：AI 舆情周报（流式生成，五段式结构），导出 Markdown
- **安全**：API key 只存浏览器，分析任务随请求传本地后端（仅内存、不落库）；key 含非 ASCII 自动拦截提示

## 快速开始

```powershell
# 依赖：Node 18+、本机 MongoDB（默认 root/1234@127.0.0.1:27017，库名 insight）

# 1. 后端（http://localhost:5176）
cd insight/server
npm install
npm run dev

# 2. 前端（http://localhost:5175，/api 与 /socket.io 已代理）
cd insight/web
npm install
npm run dev
```

其他 MongoDB 实例用环境变量覆盖：`$env:MONGO_URI = "mongodb://.../insight"`。

## 生产部署

单机部署最简单：**后端直接托管前端构建产物**（Express 已内置 `express.static` + SPA fallback），一个进程搞定前后端 + socket.io。

```powershell
# 1. 构建前端（产物输出到 web/dist，后端默认托管该目录）
cd insight/web
npm run build

# 2. 构建后端
cd insight/server
npm run build        # tsc 编译到 dist/

# 3. 启动（生产模式）
$env:NODE_ENV = "production"
$env:MONGO_URI = "mongodb://user:password@127.0.0.1:27017/insight"
npm start            # node dist/index.js，访问 http://服务器IP:5176 即前端页面
```

### 关键环境变量（详见 server/.env.example）

| 变量 | 说明 | 生产建议 |
|---|---|---|
| `MONGO_URI` | MongoDB 连接串 | **必填**，勿用默认密码 |
| `CORS_ORIGIN` | 允许的跨域域名（逗号分隔） | 填实际访问域名，勿留默认 |
| `RATE_LIMIT_PER_MIN` | 写接口限流（次/分钟/IP，0=关） | 建议 60 |
| `ENABLE_MOCK_AI` | 测试用 Mock AI 开关 | 建议 `false` |
| `NODE_ENV` | 运行环境 | `production`（错误响应不泄露内部细节） |
| `VITE_API_BASE` / `VITE_SOCKET_URL` | （前端）API / socket 地址覆盖 | 前后端同域部署无需设置 |

### 其他部署方式

- **nginx 反代**：把 `/` 指向前端静态文件，`/api` 与 `/socket.io`（需配 `proxy_http_version 1.1` + `Upgrade` 头）指向后端端口。
- **进程守护**：生产用 PM2（`pm2 start dist/index.js`）或 Docker 运行后端，保证开机自启与崩溃重启。
- **HTTPS**：AI key 经 HTTP 明文传输，公网必须走 TLS（nginx 配证书或托管平台自带）。
- **前端独立部署**：前后端不同域时，构建时设置 `VITE_API_BASE` 与 `VITE_SOCKET_URL` 指向后端地址。

### 版本管理

项目已初始化 git，建议提交首个版本后再部署：`git add -A && git commit -m "init"`（密钥类内容已由 .gitignore 排除，提交前请检查 `git status`）。

## 演示路径（3 分钟）

1. **导入数据** → 点「某 App 大版本更新」→ 自动进入监控台
2. **监控台**：看情感分布 / 趋势 / 主题 / 词云四张图表
3. **实时监控**：点「▶ 播放模拟」→ 评论按时间轴流入，负面激增段触发告警横幅（先去「告警中心」加一条负面率规则）
4. **告警中心**：确认告警、配置规则
5. **智能分析**：配置 key 后对导入数据跑批量分析（内置场景已预标注，可跳过）
6. **舆情报告**：一键生成 AI 周报 → 导出 Markdown

## 目录结构

```
insight/
├── server/src/
│   ├── models.ts              # Dataset/Comment/AnalysisJob/Alert/AlertRule
│   ├── routes/                # datasets/comments/analysis/alerts/simulate
│   ├── services/              # scenarioService（3 场景生成器）/ anomalyService（Z-score）
│   └── index.ts               # Express + socket.io + MongoDB
└── web/src/
    ├── pages/                 # 数据集/导入/监控台/分析/报告/告警中心/设置
    ├── components/            # EChart 封装
    ├── api/                   # axios 封装 + API 层
    ├── lib/                   # ai（SSE 流式）/ echarts / socket
    └── store/                 # zustand 设置
```

## 自测

```powershell
cd insight/web
node scripts/sim-test.mjs   # 实时监控链路：socket 评论流 + 告警触发 + 冷却
```

## 简历写法（示例）

> **舆情雷达：AI 评论分析与舆情监控平台** | React 19 + TypeScript + Express + MongoDB + socket.io
> - 设计"导入 → AI 批量分析 → 可视化监控 → 告警 → 报告"完整管线，内置 3 套舆情场景（1300+ 条）免 key 演示
> - 实现后端分析任务队列：并发限流、断点续跑、失败重试，进度经 WebSocket 实时推送
> - 基于 MongoDB 聚合管道多维统计（情感/主题/关键词/时间趋势），ECharts 四图联动展示
> - 实现滑动窗口 Z-score 负面率异常检测与规则化告警（阈值/关键词/量突增），实时推送与冷却去抖
