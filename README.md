# Daily AI Insight Engine

[![Release](https://img.shields.io/badge/release-MVP-111827)](https://github.com/Jiupeidun/daily-ai-insight-engine)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520.9-339933)](https://nodejs.org/)
[![Agent Friendly](https://img.shields.io/badge/Agent-Friendly-blueviolet)](#agent-friendly-api)

AI 舆情分析日报系统。系统从官方博客、科技媒体、研究社区、中文资讯源和金融市场源采集近期 AI 新闻，经过清洗、去重、结构化抽取、Schema 校验、规则评分和趋势聚合，生成 Dashboard、结构化 JSON、Markdown 与 PDF 日报。

- 在线地址：[daily-ai-insight-engine.kkertin1214.workers.dev](https://daily-ai-insight-engine.kkertin1214.workers.dev/)
- 部署平台：Cloudflare Workers + OpenNext + KV + Cron
- 技术栈：Next.js App Router、Vercel AI SDK、DeepSeek/OpenAI-compatible API、Zod、Recharts、PDFKit

## 核心设计

```txt
Raw News -> Clean -> Deduplicate -> LLM Structured Extraction
         -> Zod Validation -> AI Relevance Gate -> Rule-based Scoring
         -> Trend Aggregation
         -> KV Runtime Store / Dashboard / Markdown / PDF / Agent API
```

这个项目刻意把模型能力和确定性工程逻辑拆开：

- LLM 只负责结构化抽取和报告辅助生成，不直接决定最终排序。
- `Zod` 校验所有模型输出，失败记录进入 `data/processed/failed-records.json`。
- `aiRelevance` 将新闻分成 `core / adjacent / noise`，Top Events 优先只从 core AI signal 里选，避免 GPU 游戏、折扣、广告等低价值噪声污染日报。
- 每条结构化新闻保留 `schemaVersion`、`scoringVersion`、实体、事件类型、关键事实、影响分析、风险/机会信号、置信分和证据。
- 趋势判断基于结构化事件、影响分、来源类型、实体和资本市场信号，输出技术 / 应用 / 政策 / 资本方向的判断。
- 重要性排序、趋势聚合、图表数据由程序规则生成，避免“摘要拼接”和模型一次性幻觉。
- Cloudflare Cron 每 12 小时触发一次线上刷新，结果写入 KV；页面和 API 优先读取 KV 中的最新报告。
- 采集窗口保持“上一自然日（Asia/Shanghai）+ backfill”，便于生成稳定的日报口径。

## Agent Friendly API

这个项目暴露了可被其他 agent 直接调用的稳定接口。推荐调用顺序是：先读取 manifest，再读取 schema contract 和结构化日报，最后按需追问或触发刷新。

```bash
BASE_URL="https://daily-ai-insight-engine.kkertin1214.workers.dev"

# 1. Discover callable tools, auth rules, schemas, and guidance.
curl "$BASE_URL/api/agent/manifest"

# 2. Import the OpenAPI contract into an IDE agent, workflow agent, or MCP wrapper.
curl "$BASE_URL/api/agent/openapi"

# 3. Inspect schema fields, refresh cadence, and agent usage rules.
curl "$BASE_URL/api/agent/schema"

# 4. Fetch the latest schema-validated report as the source of truth.
curl "$BASE_URL/api/report"

# 5. Ask a grounded follow-up question against the current report.
curl -X POST "$BASE_URL/api/analyze" \
  -H "content-type: application/json" \
  -d '{"question":"今天 AI 行业最重要的 3 个变化是什么？"}'

# 6. Trusted automation only: run the full refresh pipeline and write the result to KV.
curl -X POST "$BASE_URL/api/admin/generate-report" \
  -H "authorization: Bearer $REPORT_ADMIN_TOKEN"
```

Agent 使用约束：`/api/report` 是事实源；下游摘要应保留 `qualityGates`、`confidenceScore`、`evidence`、`citedUrls` 和 `relatedArticleIds`；会产生模型成本或改变状态的接口必须显式认证。

## 数据与产物

数据源定义在 `src/lib/insight/source-config.ts`，覆盖 OpenAI、Google AI、Microsoft AI、NVIDIA、TechCrunch、The Verge、WIRED、VentureBeat、MIT Technology Review、The Decoder、arXiv、BAIR、Hacker News、36Kr、IT之家、WSJ Markets、MarketWatch、CNBC、Investing.com 等。

```txt
data/raw/source-manifest.json          数据源说明
data/raw/news-items.json               原始新闻
data/processed/structured-news.json    结构化抽取结果
data/processed/failed-records.json     失败记录
data/reports/latest.json               最新日报 JSON
data/reports/latest.md                 最新日报 Markdown
data/reports/latest-ai-insight-report.pdf
Cloudflare KV latest:report             线上运行时最新报告
```

## 本地运行

```bash
npm install
npm run pipeline
npm run dev
```

环境变量示例：

```bash
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=
AI_MODEL=deepseek-chat
AI_EXTRACTION_BATCH_SIZE=20
AI_EXTRACTION_CONCURRENCY=3
REPORT_ADMIN_TOKEN=
```

## 常用命令

```bash
npm run collect        # 采集 RSS/Feed 数据
npm run generate       # 生成结构化日报
npm run generate:pdf   # 生成 PDF
npm run pipeline       # collect + generate + generate:pdf
npm run validate       # lint + typecheck + test + build
npm run deploy         # OpenNext build + Cloudflare deploy
```

## 项目结构

```txt
src/app/                    Next.js 路由、Dashboard、API
src/components/dashboard/   图表、控件、日报操作
src/components/analytics/   Google Analytics
src/lib/insight/            Schema、清洗、抽取、评分、报告生成
src/lib/pdf/                PDF 渲染
scripts/                    采集和离线生成脚本
data/                       原始数据、结构化数据、日报产物
public/reports/             可下载 PDF
```
