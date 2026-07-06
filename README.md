# Daily AI Insight Engine

Daily AI Insight Engine is an AI public-opinion and intelligence report system for the AI application coding assignment. It collects AI-related news from official, media, community, and research feeds, normalizes the raw records, uses the Vercel AI SDK to extract schema-validated insights, aggregates trends, and generates a downloadable daily PDF report.

The product is deployed on Cloudflare Workers through OpenNext. The dashboard is designed as a single-screen terminal workspace: the left side shows the AI processing pipeline and AI-only visual analysis, while the right side keeps a focused AI information stream.

## Product Scope

- On-demand PDF generation: the `Generate PDF` button calls the backend, invokes DeepSeek through the Vercel AI SDK, validates the response, and downloads the daily report.
- Scheduled AI refresh: `.github/workflows/refresh-report.yml` runs every 12 hours, calls DeepSeek, regenerates the data artifacts and PDF, commits the result, and deploys the updated site to Cloudflare.
- Ready-on-arrival dashboard: visitors see the latest pre-generated report immediately; manual PDF generation is an additional action, not the only way to populate the page.
- Source diversity: feeds include OpenAI News, Google AI, Microsoft AI Platform, NVIDIA AI, TechCrunch AI, The Verge AI, WIRED AI, VentureBeat AI, MIT Technology Review AI, The Decoder, arXiv, Berkeley AI Research, Hacker News AI search, 36Kr, and IT Home.
- Schema-first extraction: `generateObject({ schema: NewsInsightSchema })` turns raw articles into auditable insight objects instead of shallow summaries.
- Error transparency: PDF generation errors return backend details and a `requestId`; the frontend displays the real message instead of a generic failure.
- Internationalization and theming: Chinese/English language switching, dark/light/system theme modes, local user clock, and mobile layout support are built into the UI.
- Observability: Cloudflare Worker logs include request-level stages for PDF generation and AI synthesis.

## Architecture

```txt
Raw News
  ↓
Normalize & Clean
  ↓
Deduplicate
  ↓
LLM Structured Extraction
  ↓
Zod Schema Validation
  ↓
Rule-based Scoring
  ↓
Aggregation
  ↓
Daily Report Generation
  ↓
Dashboard Visualization
  ↓
PDF Export
```

The system intentionally separates model reasoning from deterministic application logic:

- The model extracts entities, categories, event types, key facts, sentiment, risk signals, opportunity signals, and evidence.
- Zod validates the model response before it can enter the report pipeline.
- Ranking and chart aggregation are constrained by program logic, so the dashboard is not just a prompt-rendered page.
- The PDF endpoint performs one AI report-synthesis call on demand, which keeps the Worker request short enough for production use.

## Core Schema

The main schema lives in `src/lib/insight/schema.ts`.

`NewsInsightSchema` captures:

- identity: `id`, `title`, `source`, `url`, `published_at`, `language`
- source classification: `source_type`
- business taxonomy: `category`, `event_type`
- extracted entities: companies, models, products, people, organizations, and technologies
- report substance: `summary`, `key_facts`, `impact_analysis`
- model judgment: `sentiment`, `importance_score`, `confidence_score`
- action signals: `risk_signals`, `opportunity_signals`
- audit trail: field-level `evidence`

The internal `ArticleInsight` schema extends this with canonical events, value-chain taxonomy, rule-based impact scoring, chart signals, extraction metadata, and normalized entity groups.

## AI Implementation

The project uses the Vercel AI SDK server-side:

- `src/lib/insight/extract.ts`: structured extraction with `generateObject` and `NewsInsightSchema`
- `src/lib/insight/report.ts`: report synthesis with `generateObject` and `AiReportSupportSchema`
- `src/app/api/analyze/route.ts`: analyst Q&A with `generateText`
- `src/app/api/report/pdf/route.ts`: on-demand AI synthesis followed by PDF rendering

DeepSeek is configured through Cloudflare Worker secrets and environment variables. The API key never enters the client bundle.

```bash
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=
AI_MODEL=deepseek-chat
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-KD5YSDV426
```

## Data Sources

Source definitions live in `src/lib/insight/source-config.ts`.

Generated artifacts:

```txt
data/raw/source-manifest.json
data/raw/news-items.json
data/processed/structured-news.json
data/processed/failed-records.json
data/reports/latest.json
data/reports/latest.md
public/reports/latest-ai-insight-report.pdf
```

The collector samples across sources and deduplicates by canonical URL and title. Chinese high-frequency feeds use stricter AI relevance filtering, while specialized AI feeds can use broader content matching.

## Cloudflare Deployment

The app runs on Cloudflare Workers with Next.js App Router and OpenNext.

```bash
npm install
npm run pipeline
npm run deploy
```

`wrangler.jsonc` configures:

- OpenNext Worker entry: `.open-next/worker.js`
- static assets: `.open-next/assets`
- `nodejs_compat`
- smart placement
- Worker logs and invocation logs
- trace sampling

## Skills Used

- Cloudflare deployment skill: guided Workers/OpenNext deployment, Worker logging, secrets, and production configuration.
- Wrangler skill: used for Worker deployment and keeping Cloudflare configuration aligned with the repo.
- React best practices skill: used as the frontend engineering reference for smaller client islands, server-rendered data loading, and scoped interactivity.
- PDF skill: used for PDF-generation and render-quality decisions around fonts, layout, and download behavior.
- L-Observatoire design reference: used as the visual reference for the terminal-style workspace and right-rail intelligence feed.
- Vercel AI SDK pattern: used for typed model calls with `generateObject` and Zod schemas instead of handwritten provider JSON parsing.

## Project Structure

```txt
src/app/                    Next.js routes and dashboard page
src/components/dashboard/   client-side controls, charts, and report actions
src/components/analytics/   Google Analytics integration
src/lib/insight/            schemas, normalization, extraction, scoring, report generation
src/lib/pdf/                PDF rendering
scripts/                    RSS collection and offline report generation
data/raw/                   source manifest and raw collected items
data/processed/             validated structured insights and failed records
data/reports/               final report JSON and Markdown output
public/reports/             downloadable generated PDF
docs/                       interview explanation notes
```

---

# Daily AI Insight Engine 中文说明

Daily AI Insight Engine 是为 AI 应用笔试题实现的 AI 舆情分析日报系统。系统会从官方、媒体、社区、研究等来源采集 AI 相关新闻，完成清洗、去重、结构化抽取、Schema 校验、趋势聚合，并生成可下载的当日 PDF 日报。

项目通过 OpenNext 部署在 Cloudflare Workers 上。首页是单屏终端工作台：左侧展示 AI 处理链路和只由 AI 抽取结果驱动的可视化分析，右侧保留 AI 信息流。

## 产品范围

- 12 小时定时刷新：`.github/workflows/refresh-report.yml` 每 12 小时运行一次，调用 DeepSeek，重新生成数据产物和 PDF，提交结果并部署到 Cloudflare。
- 打开即有结果：访问者进入页面后直接看到最近一次预生成日报；手动生成 PDF 是额外操作，不是填充首页的唯一方式。
- 多源信息流：信息源包括 OpenAI News、Google AI、Microsoft AI Platform、NVIDIA AI、TechCrunch AI、The Verge AI、WIRED AI、VentureBeat AI、MIT Technology Review AI、The Decoder、arXiv、Berkeley AI Research、Hacker News AI Search、36Kr、IT之家等。
- Schema-first 抽取：使用 `generateObject({ schema: NewsInsightSchema })` 把新闻变成可审计的洞察对象，而不是简单摘要。
- 错误透明：PDF 生成失败时，后端返回真实错误和 `requestId`，前端直接展示，不再只显示“生成失败”。
- 国际化和主题：支持中英文切换、深色/浅色/跟随系统主题、本地时钟和移动端布局。
- 可观测性：Cloudflare Worker 日志记录 PDF 生成和 AI 合成的关键阶段。

## 系统架构

```txt
原始新闻
  ↓
标准化与清洗
  ↓
去重
  ↓
LLM 结构化抽取
  ↓
Zod Schema 校验
  ↓
规则评分
  ↓
聚合
  ↓
日报生成
  ↓
首页可视化
  ↓
PDF 导出
```

系统刻意把模型推理和确定性程序逻辑分开：

- 模型负责抽取实体、分类、事件类型、关键事实、情绪、风险信号、机会信号和证据。
- Zod 负责在数据进入报告链路前做结构校验。
- 排序和图表聚合由程序逻辑约束，避免首页只是 prompt 渲染结果。
- PDF 接口在用户点击时只做一次 AI 报告合成调用，避免 Worker 请求过长导致浏览器报 `Failed to fetch`。

## 核心 Schema

核心 Schema 位于 `src/lib/insight/schema.ts`。

`NewsInsightSchema` 覆盖：

- 身份字段：`id`、`title`、`source`、`url`、`published_at`、`language`
- 来源分类：`source_type`
- 业务分类：`category`、`event_type`
- 实体抽取：公司、模型、产品、人物、组织和技术
- 报告内容：`summary`、`key_facts`、`impact_analysis`
- 模型判断：`sentiment`、`importance_score`、`confidence_score`
- 行动信号：`risk_signals`、`opportunity_signals`
- 审计证据：字段级 `evidence`

内部 `ArticleInsight` 会继续扩展 canonical event、价值链分类、规则影响评分、图表信号、抽取元数据和标准化实体组。

## AI 实现

项目在服务端使用 Vercel AI SDK：

- `src/lib/insight/extract.ts`：用 `generateObject` 和 `NewsInsightSchema` 做结构化抽取
- `src/lib/insight/report.ts`：用 `generateObject` 和 `AiReportSupportSchema` 做报告合成
- `src/app/api/analyze/route.ts`：用 `generateText` 做分析问答
- `src/app/api/report/pdf/route.ts`：按需 AI 合成日报并渲染 PDF

DeepSeek 通过 Cloudflare Worker secret 和环境变量配置，API key 不会进入前端 bundle。

```bash
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=
AI_MODEL=deepseek-chat
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-KD5YSDV426
```

## 数据源

数据源定义在 `src/lib/insight/source-config.ts`。

生成产物：

```txt
data/raw/source-manifest.json
data/raw/news-items.json
data/processed/structured-news.json
data/processed/failed-records.json
data/reports/latest.json
data/reports/latest.md
public/reports/latest-ai-insight-report.pdf
```

采集器会按来源轮询抽样，并通过规范化 URL 和标题去重。中文高频 feed 使用更严格的 AI 相关性过滤；AI 垂直媒体和官方源可以使用更宽的内容匹配。

## Cloudflare 部署

应用使用 Next.js App Router + OpenNext 部署到 Cloudflare Workers。

```bash
npm install
npm run pipeline
npm run deploy
```

`wrangler.jsonc` 配置了：

- OpenNext Worker 入口：`.open-next/worker.js`
- 静态资源目录：`.open-next/assets`
- `nodejs_compat`
- smart placement
- Worker logs 与 invocation logs
- trace sampling

## 使用的 Skills

- Cloudflare deployment skill：用于 Workers/OpenNext 部署、日志、secrets 和生产配置。
- Wrangler skill：用于 Worker 部署，以及让 Cloudflare 配置和仓库保持一致。
- React best practices skill：用于前端工程参考，包括小型 client islands、服务端数据读取和交互隔离。
- PDF skill：用于 PDF 生成、字体、排版和下载行为的实现判断。
- L-Observatoire 设计参考：用于终端风格工作台和右侧信息流布局。
- Vercel AI SDK pattern：用于 `generateObject` + Zod schema 的类型化模型调用，替代手写 provider JSON 解析。

## 项目结构

```txt
src/app/                    Next.js 路由和首页
src/components/dashboard/   客户端控件、图表和日报操作
src/components/analytics/   Google Analytics 集成
src/lib/insight/            Schema、清洗、抽取、评分、报告生成
src/lib/pdf/                PDF 渲染
scripts/                    RSS 采集和离线报告生成
data/raw/                   信息源 manifest 和原始新闻
data/processed/             结构化洞察和失败记录
data/reports/               最终 JSON 和 Markdown 日报
public/reports/             可下载 PDF
docs/                       面试讲解材料
```
