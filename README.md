# Daily AI Insight Engine

一个面向 AI coding 面试的 **AI 舆情分析日报系统 MVP**。它不是把新闻一次性丢给模型生成摘要，而是把数据获取、清洗、Schema 抽取、校验、聚合分析、可视化和部署路径都做成可复现工程链路。

## Demo Scope

- 前端：Next.js App Router 仪表盘，展示日报、质量门、趋势图、Top events、深度分析和结构化表。
- 后端/部署：Cloudflare Workers + OpenNext，`wrangler.jsonc` 已配置 Workers AI binding、`nodejs_compat`、observability 和 smart placement。
- 数据：RSS 自动采集 10-20 条近期 AI 信息，保留原始数据与 source manifest。
- AI：支持三种模式：
  - `deterministic`：无 key 可复现的规则抽取，CI 和面试现场兜底。
  - `openai_compatible`：任意 OpenAI-compatible API。
  - `cloudflare_rest`：本地脚本调用 Cloudflare Workers AI REST。
  - 部署后 `/api/analyze` 可直接使用 Cloudflare Workers AI binding。

## Quick Start

```bash
npm install
npm run pipeline
npm run dev
```

打开 `http://localhost:3000`。

常用命令：

```bash
npm run collect      # RSS 采集，写入 data/raw/news-items.json
npm run generate     # 结构化抽取并生成 data/reports/latest.json + latest.md
npm run validate     # lint + typecheck + test + build
npm run preview      # OpenNext Cloudflare 本地预览
npm run deploy       # 部署到 Cloudflare Workers
```

## Data Sources

数据源定义在 `src/lib/insight/source-config.ts`，当前样例输出在：

- `data/raw/source-manifest.json`
- `data/raw/news-items.json`
- `data/processed/structured-news.json`
- `data/reports/latest.json`
- `data/reports/latest.md`

选择逻辑：

- 官方源用于降低二手解读噪音，例如 OpenAI News。
- 科技媒体用于捕捉产品、资本、企业采用和争议信号。
- 中文源用于补充本地 AI 应用和产业信息。
- Hacker News 用作开发者社区早期讨论代理。
- RSS 优先，因为它可复现、带时间戳、便于审计。

采集策略不是简单按时间截断，而是按来源轮询抽样后去重，避免一个高频 feed 占满 18 条。

## Schema Design

核心 Schema 在 `src/lib/insight/schema.ts`。每篇新闻会被抽取为 `ArticleInsight`：

- `canonicalEvent`：发生了什么、为什么重要、影响主体、证据片段、置信度。
- `taxonomy`：主题、价值链位置、成熟度。
- `impact`：影响分、时间范围、利益相关方、风险、机会。
- `entities`：组织、产品、人物、地区。
- `signals`：新颖性、采用度、技术深度、监管权重、资本强度。
- `extractionMeta`：抽取方法、prompt 版本、校验时间、warning。

这样设计的原因：日报不是摘要拼接，而是把每条信息变成可聚合、可验证、可解释的决策信号。图表和 Top events 都来自结构化字段，不直接从原文拼文本。

## AI Usage

抽取入口在 `src/lib/insight/extract.ts`：

1. 原始文章分批处理，默认 batch size 为 4。
2. AI prompt 要求只返回 JSON，不允许整批自由发挥写报告。
3. 每批输出必须通过 Zod 校验。
4. 校验失败、API 不可用或无 key 时，自动进入 deterministic fallback。
5. 日报生成只读取 `ArticleInsight[]`，不读取原始全文。

本地接入 OpenAI-compatible API：

```bash
AI_PROVIDER=openai_compatible
AI_BASE_URL=https://api.example.com/v1
AI_API_KEY=...
AI_MODEL=...
npm run generate
```

本地接入 Cloudflare Workers AI REST：

```bash
AI_PROVIDER=cloudflare_rest
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
npm run generate
```

Cloudflare 部署后，`/api/analyze` 使用 `env.AI.run(...)`；本地 `next dev` 没有 binding 时会返回可复现的 deterministic answer。

## Frontend Engineering

前端实现参考：

- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Vercel React best practices skill: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices

落实点：

- 页面主体是 Server Component，读取本地日报 JSON 并完成数据裁剪。
- Recharts 在 client component 中通过 `next/dynamic` 懒加载，避免把重图表库放进首屏主 bundle。
- Client boundary 只传图表需要的最小数据，避免 RSC 序列化整份 report。
- 长列表、表格行、质量门卡片使用 `content-visibility: auto`。
- 不在组件内部定义子组件，避免每次 render 重新 mount。
- 首屏是工作台，不做营销 landing page。

## Cloudflare Deployment

部署使用 OpenNext for Cloudflare Workers：

```bash
npm run cf-typegen
npm run deploy
```

`wrangler.jsonc` 包含：

- `main: .open-next/worker.js`
- `assets.directory: .open-next/assets`
- `compatibility_date: 2026-07-06`
- `compatibility_flags: ["nodejs_compat"]`
- `ai.binding: "AI"`
- `observability.enabled: true`
- `placement.mode: "smart"`

本地更贴近生产的预览：

```bash
npm run preview
```

## Commit Convention

提交信息按 Conventional Commits：

```txt
feat: build daily AI insight engine MVP
fix: tighten AI relevance filtering
docs: document Cloudflare deployment workflow
```

规范来源：https://www.conventionalcommits.org/en/v1.0.0/

## Project Structure

```txt
src/app/                    Next.js routes, dashboard page, API routes
src/components/dashboard/   Client-only chart layer
src/lib/insight/            Schema, normalization, extraction, report generation
scripts/                    RSS collection and report generation CLI
data/raw/                   Source manifest and raw collected items
data/processed/             Validated structured insights
data/reports/               Final report JSON and Markdown sample
docs/                       Interview explanation notes
```

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Current sample:

- 18 raw items
- 18 structured items
- 8 sources represented in final sample
- Chinese/mixed + English language mix
- Report JSON and Markdown output committed for review
