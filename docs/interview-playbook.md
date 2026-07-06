# Interview Playbook

## 60-second opening

我把题目拆成一条可复查流水线：RSS 采集近期 AI 信息，清洗去重，分批抽取结构化事件，Zod 校验，失败进入 fallback，再从结构化字段生成日报和图表。这样避免了“一次性把原始数据丢给 AI 生成报告”的低质量模式。

## What to show first

1. `data/raw/news-items.json`：原始数据、失败源、采集时间、来源信息。
2. `src/lib/insight/schema.ts`：Schema 不是 summary，而是事件、主体、影响、趋势、风险机会和质量元数据。
3. `src/lib/insight/extract.ts`：分批 prompt、AI provider adapter、Zod 校验、fallback。
4. `data/reports/latest.md`：完整日报样例。
5. Web dashboard：质量门、图表、Top events、结构化表。

## Engineering decisions

- RSS 而不是网页爬虫：一天内完成 MVP，RSS 可复现、少受页面结构变化影响。
- 轮询采样：避免 Hacker News 或单一高频媒体占满 Top 18。
- Zod 做强校验：AI 输出必须变成可靠结构，不能直接进入报告。
- deterministic fallback：没有 API key 或模型 JSON 不稳定时，系统仍可演示和测试。
- Cloudflare Workers AI：部署后通过 binding 调用，避免在 Worker 内部手写 Cloudflare REST 鉴权。
- Recharts 动态加载：图表库不进入首屏主 bundle。

## Live demo commands

```bash
npm run collect
npm run generate
npm run validate
npm run dev
```

Optional Cloudflare preview:

```bash
npm run preview
```

Optional deploy:

```bash
npm run deploy
```

## How this exceeds a normal AI-coding answer

- 有数据质量门，而不是只展示漂亮页面。
- 有结构化 Schema 和 prompt 版本，而不是黑盒摘要。
- 有 fallback、校验和测试，模型失败不会导致系统不可用。
- 有 Cloudflare 部署配置、Workers AI binding 和 observability。
- 前端按 Vercel React best practices 拆分 RSC/Client boundary，并动态加载重图表库。
