<div align="center">

📡 舆情雷达 InsightScope

AI 用户评论分析与舆情监控平台

把散落的用户评论，变成一条「采集 → 分析 → 监控 → 告警 → 报告」的完整舆情处置链路。

















</div>

---

💡 这是什么？

InsightScope 是一个前端为主的 AI 全栈项目，帮助产品 / 运营 / 公关团队把用户评论变成可执行的舆情判断：

- 📥 采集：一键导入 3 个内置舆情场景（App 更新 / 新品发布 / 公关危机，1300+ 条真实格式评论），也支持粘贴导入
- 🧠 分析：调用 OpenAI 兼容接口（OpenAI / DeepSeek 均可）对评论做批量情感 / 主题 / 关键词分析
- 📊 监控：可视化大盘实时呈现情感分布、趋势、热门主题与关键词词云
- 🚨 告警：负面率异常自动触发告警，支持规则配置与确认流转
- 📝 报告：一键生成 AI 舆情周报（流式输出），导出 Markdown

内置数据已预标注，无需 API key 即可完整体验；配合实时模拟器，能直观看到"评论流入 → 负面激增 → 告警弹出"的全过程。

✨ 特性

- 🎬 实时模拟器 — 按时间轴重放评论（1x–20x 加速），流入动画 + 告警实时弹窗
- ⚙️ 批量分析队列 — 并发限流、断点续跑、失败重试，WebSocket 实时推送进度，可暂停 / 恢复 / 取消
- 🚨 智能告警 — 负面率阈值 / 评论量 / 敏感关键词规则 + 滑动窗口 Z-score 异常检测 + 60s 冷却防抖
- 🖥 可视化大盘 — 情感环形图 · 按天趋势 · 热门主题 · 关键词云四图联动
- 📝 AI 周报 — 五段式结构流式生成，一键导出 Markdown
- 🔒 安全设计 — API key 只存浏览器、仅内存不落库；可选 ACCESS_TOKEN 访问口令保护全部接口
- 🧩 零门槛演示 — 内置 3 个预标注场景，免 key 开箱即用

🖼 界面预览

💡 把你的截图放到 docs/screenshots/，替换下面两行即可。





🛠 技术栈

  层   	技术                                      
  前端  	Vite · React 19 · TypeScript · Tailwind CSS 4 · Zustand · TanStack Query · ECharts（词云）· framer-motion · socket.io-client
  后端  	Express · Sequelize (MySQL) · socket.io · axios
  AI  	OpenAI 兼容 /chat/completions（OpenAI / DeepSeek）· SSE 流式输出

🚀 快速开始

依赖：Node 18+ 与本地 MySQL（启动时自动建库建表，默认 root/1234@127.0.0.1:3306/plfx）

    # 1. 启动后端（http://localhost:5176）
    cd server
    npm install
    npm run dev
    
    # 2. 启动前端（http://localhost:5175，/api 与 /socket.io 已代理）
    cd web
    npm install
    npm run dev

然后打开 http://localhost:5175 → 导入一个内置场景 → 点「▶ 播放模拟」→ 看监控台"活"起来。

🧭 三分钟演示

1. 导入数据：选「某 App 大版本更新」，自动进入监控台
2. 看大盘：情感分布 / 趋势 / 主题 / 词云四张图表
3. 实时监控：播放模拟，评论流入，负面激增触发告警横幅
4. 告警中心：确认告警、配置负面率规则
5. AI 分析：填 key 跑批量分析（内置场景已预标注，可跳过）
6. 生成周报：一键生成 AI 舆情周报并导出 Markdown

📁 目录结构

    ├── server/               # Express + socket.io + Sequelize(MySQL)
    │   └── src/
    │       ├── models.ts     # Dataset / Comment / AnalysisJob / Alert / AlertRule
    │       ├── routes/       # datasets / comments / analysis / alerts / simulate / feeds
    │       ├── services/     # 场景生成器 / Z-score 异常检测
    │       └── index.ts      # 入口（Express + socket.io + MySQL）
    └── web/                  # Vite + React 19 + Tailwind 4
        └── src/
            ├── pages/        # 数据集 / 导入 / 监控台 / 分析 / 报告 / 告警中心 / 设置
            ├── components/   # ECharts 封装等
            ├── api/          # axios 封装与 API 层
            ├── lib/          # AI 流式调用 / echarts / socket
            └── store/        # zustand 状态
