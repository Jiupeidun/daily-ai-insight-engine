# Daily AI Insight Engine

一个面向 AI coding 面试的 **AI 舆情分析日报系统 MVP**。系统每天采集近期 AI 信息，完成清洗、结构化抽取、质量校验、趋势聚合、可视化，并生成可下载的 PDF 日报。

An **AI daily intelligence report MVP** for an AI coding interview. It collects recent AI signals, normalizes them, extracts schema-validated insights, runs quality gates, renders a one-page dashboard, and generates a downloadable PDF report.

## 产品能力 / Product

- 单屏工作台：桌面端首页固定在 one-page dashboard，长内容在卡片内部滚动。
- One-page dashboard: the desktop view keeps the product inside a single viewport; long content scrolls inside panels.
- PDF 日报：`public/reports/latest-ai-insight-report.pdf` 可直接下载。
- PDF report: the current report is generated as `public/reports/latest-ai-insight-report.pdf`.
- 中英切换与深浅色切换：偏好写入 `localStorage`，刷新后保留。
- Chinese/English and dark/light mode: preferences persist through `localStorage`.
- Google Analytics：已默认配置 `G-KD5YSDV426`，也可用 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 覆盖。
- Google Analytics: defaults to `G-KD5YSDV426`, and can be overridden with `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- OpenAI：生产环境默认走官方 API，`AI_API_KEY` 只作为服务端 secret 保存，不进入前端 bundle。
- OpenAI: production defaults to the official API, with `AI_API_KEY` stored only as a server-side secret.
- Cloudflare 部署：Next.js App Router + OpenNext + Workers secrets。
- Cloudflare deployment: Next.js App Router + OpenNext + Workers secrets.

## Quick Start / 快速开始

```bash
npm install
npm run pipeline
npm run dev
```

Open `http://localhost:3000`.

常用命令 / Common commands:

```bash
npm run collect        # RSS collection -> data/raw/news-items.json
npm run generate       # structured report -> data/reports/latest.json + latest.md
npm run generate:pdf   # PDF report -> public/reports/latest-ai-insight-report.pdf
npm run pipeline       # collect + generate + generate:pdf
npm run validate       # lint + typecheck + test + build
npm run preview        # OpenNext Cloudflare local preview
npm run deploy         # deploy to Cloudflare Workers
```

## Environment / 环境变量

Copy `.env.example` when running locally.

```bash
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
REPORT_ADMIN_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-KD5YSDV426
```

`NEXT_PUBLIC_GA_MEASUREMENT_ID` is optional because the app has a checked-in fallback measurement ID. Set it when deploying a different GA property.

`NEXT_PUBLIC_GA_MEASUREMENT_ID` 可选，因为代码里已经有默认 GA ID。换成其他 GA property 时再覆盖。

## Data Pipeline / 数据链路

数据源定义在 `src/lib/insight/source-config.ts`。输出文件：

Data sources live in `src/lib/insight/source-config.ts`. Generated artifacts:

- `data/raw/source-manifest.json`
- `data/raw/news-items.json`
- `data/processed/structured-news.json`
- `data/processed/failed-records.json`
- `data/reports/latest.json`
- `data/reports/latest.md`
- `public/reports/latest-ai-insight-report.pdf`

采集策略按来源轮询抽样后去重，避免单一高频 feed 占满日报。

The collector samples across sources and deduplicates items so one noisy feed cannot dominate the report.

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
```

清洗阶段会处理字段缺失、发布时间格式、语言标记和 source_type 标记，例如 OpenAI Blog → official、TechCrunch → media、Hacker News → community、arXiv → research。

Extraction is batched at 3-5 items instead of sending the whole corpus into one prompt. This reduces cross-article contamination in long contexts while still keeping request count manageable.

AI JSON is validated with Zod. Invalid output is repaired once with a targeted repair prompt. If repair still fails, the item is written to `data/processed/failed-records.json` and skipped from aggregation.

Importance is not blindly delegated to the model. The rule-based score combines source weight, key-entity weight, category weight, sentiment/risk weight, and recency weight; model output provides analysis, but ranking is constrained by program logic.

## Schema / 结构化抽取

核心 Schema 在 `src/lib/insight/schema.ts`。每条新闻会被抽取为 `ArticleInsight`，同时导出面试讲解用的 `NewsInsightSchema` 视图：

The core schema is in `src/lib/insight/schema.ts`. Each item becomes an `ArticleInsight`, with a `NewsInsightSchema` view for interview explanation:

- `category`: model release, AI product, infrastructure, research, policy, capital, security, or industry application.
- `eventType`: launch, upgrade, partnership, funding, regulation, research result, controversy, or market signal.
- `keyFacts`: extracted factual bullets that support downstream reporting.
- `impactAnalysis`: why the item matters beyond a plain summary.
- `canonicalEvent`: what happened, why it matters, affected actors, evidence, confidence.
- `taxonomy`: topic, value-chain position, maturity.
- `impact`: score, horizon, stakeholders, risks, opportunities.
- `entities`: normalized company/model/product/person/organization/technology records plus organizations, products, people, geographies.
- `signals`: novelty, adoption, technical depth, regulatory weight, capital intensity.
- `evidence`: field-level quotes or reasoning for auditability.
- `extractionMeta`: extraction method, prompt version, validation timestamp, warnings.

这样做的目的不是拼摘要，而是把新闻变成可聚合、可审计、可解释的决策信号。

The point is not stitched summarization; it is turning news into aggregatable, auditable, explainable decision signals.

## AI Modes / AI 模式

抽取入口在 `src/lib/insight/extract.ts`。支持：

Extraction starts in `src/lib/insight/extract.ts`. Supported modes:

- `openai_compatible`: default production mode for the official OpenAI API.
- `deterministic`: reproducible fallback without API keys.
- `cloudflare_rest`: local scripts call Cloudflare Workers AI REST.
- deployed `/api/analyze`: uses the server-side OpenAI secret and the same structured report context.

当前仓库里的日报由 `npm run pipeline` 生成：采集新闻、调用 OpenAI 抽取结构化信号、Zod 校验、规则评分、聚合首页图表数据、再生成 PDF。没有 API key 时可以显式使用 `AI_PROVIDER=deterministic` 生成可复现样例；OpenAI 模式下模型响应不合规会先 repair，仍失败则写入 failed records 并跳过。

The committed report is generated by `npm run pipeline`: collect news, call OpenAI for structured extraction, validate with Zod, apply rule-based scoring, aggregate dashboard chart data, then render the PDF. In OpenAI mode, invalid model output is repaired once; failed repair is written to failed records and skipped.

OpenAI local run:

```bash
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
npm run pipeline
```

On-demand PDF generation:

```txt
Generate PDF button
  → POST /api/report/pdf
  → OpenAI structured extraction
  → Zod validation + repair
  → rule-based scoring and aggregation
  → PDF response
```

The PDF endpoint intentionally fails instead of downloading fallback content when OpenAI is not configured or AI validation does not pass.

Cloudflare Workers AI REST local run:

```bash
AI_PROVIDER=cloudflare_rest
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
npm run generate
```

## Frontend Engineering / 前端工程

参考 / References:

- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Vercel React best practices skill: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

落实点 / Implementation notes:

- 首页数据读取和聚合保留在 Server Component。
- Report data loading and aggregation stay in Server Components.
- 交互拆成小 client islands：偏好切换、下载按钮、虚拟列表、图表。
- Interactivity is isolated into small client islands: preferences, report actions, virtual list, charts.
- Recharts 通过 `next/dynamic` 懒加载，避免图表库进入主 server surface。
- Recharts is dynamically loaded with `next/dynamic`.
- `Structured Extraction` 使用轻量虚拟列表，长结果在卡片内部滚动。
- `Structured Extraction` uses a lightweight virtual list inside its panel.
- 桌面端 `100dvh` 单屏布局，移动端切换为垂直响应式布局。
- Desktop uses a `100dvh` one-page layout; mobile switches to a responsive vertical layout.

## Cloudflare Deployment / Cloudflare 部署

```bash
npm run cf-typegen
npm run deploy
```

`wrangler.jsonc` includes:

- `main: .open-next/worker.js`
- `assets.directory: .open-next/assets`
- `compatibility_date: 2026-07-06`
- `compatibility_flags: ["nodejs_compat"]`
- `observability.enabled: true`
- `placement.mode: "smart"`

## Commit Convention / 提交规范

Use Conventional Commits:

```txt
feat: build daily AI insight engine MVP
fix: tighten AI relevance filtering
docs: document Cloudflare deployment workflow
```

Spec: https://www.conventionalcommits.org/en/v1.0.0/

## Project Structure / 项目结构

```txt
src/app/                    Next.js routes, dashboard page, API routes
src/components/dashboard/   dashboard client islands and chart layer
src/components/analytics/   Google Analytics integration
src/lib/insight/            schema, normalization, extraction, report generation
scripts/                    RSS collection, report generation, PDF generation
data/raw/                   source manifest and raw collected items
data/processed/             validated structured insights
data/reports/               final report JSON and Markdown sample
public/reports/             downloadable PDF report
docs/                       interview explanation notes
```

## Validation / 验证

```bash
npm run validate
```

Current sample:

- 18 raw items
- 18 structured items
- 8 sources represented
- Chinese/mixed + English language mix
- JSON, Markdown, and PDF report outputs
