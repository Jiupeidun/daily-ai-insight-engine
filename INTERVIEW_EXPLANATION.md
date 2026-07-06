# 面试讲解备忘：数据源筛选与 Schema 设计

## 1. 数据源是怎么筛选的？

这个项目不是让 AI 随机上网找新闻，也不是只靠人工随便挑几个 RSS。我的做法是：人工先定义信息源框架和筛选规则，再让系统按规则采集、清洗、去重、结构化抽取。

核心思路是控制信息源的“信息熵”和“可信度”：

- 官方源：OpenAI、Google DeepMind、Microsoft、AWS、NVIDIA、Databricks 等。价值是可信度高，适合确认重大产品、模型、基础设施发布。
- 技术媒体源：TechCrunch、The Verge、WIRED、MIT Technology Review、The Decoder、Tom's Hardware、SemiAnalysis 等。价值是覆盖面广，能补充官方源不会主动披露的竞争、供应链、产品化和市场反馈。
- 研究源：MIT News、arXiv、Berkeley AI Research、ScienceDaily 等。价值是识别技术方向的早期信号，避免日报只变成产品新闻汇总。
- 开发者/实践者源：Simon Willison、Latent Space、KDnuggets、Towards Data Science 等。价值是观察模型、Agent、工具链在真实开发者社区中的采用和争议。
- 金融市场源：WSJ Markets、MarketWatch、CNBC、Investing.com 等。价值是作为资本市场验证信号，判断 AI 产业链事件是否已经反映到芯片、云、存储、数据中心、企业软件等资产价格叙事中。
- 聚合/社区源：Hacker News AI Search 等。价值是捕捉早期讨论，但权重不会高于官方和高质量媒体源。

所以这里的“AI 筛选”不是让模型决定看什么源，而是让系统先用明确的 source type、rationale、AI 相关关键词、去重规则和质量门把数据入口约束住。AI 主要负责结构化抽取和语义判断，数据源白名单和质量标准由工程规则控制。

## 2. 为什么要加金融类数据源？

题目要求日报能支持趋势判断和风险/机会识别。如果只看技术新闻，容易得到“某模型发布了”“某公司上线了新功能”这种浅层结论。

金融类数据源的作用是提供资本市场侧验证：

- 如果 AI 基础设施新闻同时出现在半导体、存储、数据中心、云厂商相关财经报道中，说明它不只是技术事件，也可能影响产业链预期。
- 如果某个模型或产品发布没有任何资本市场反馈，系统会把它更多视为产品/技术信号，而不是资本信号。
- 如果出现 AI 芯片延迟、存储股大跌、数据中心资本开支变化，这类新闻会被映射到 `capital_market`、`ai_infrastructure`、`market` value chain，进入风险/机会判断。

这能让报告从“新闻摘要”升级为“技术 + 应用 + 政策 + 资本”的综合判断。

## 3. Schema 的设计思路是什么？

Schema 的目标不是保存 summary，而是把每条新闻抽象成可以审计、可以排序、可以聚合的事件对象。

当前核心 schema 是 `ArticleInsightSchema`，主要分成几层：

- 版本字段：`schemaVersion`、`scoringVersion`。用于说明当前抽取结构和评分规则是哪一版，后续模型输出风格变化时可以升级兼容。
- 原始事实字段：`title`、`sourceName`、`sourceType`、`url`、`publishedAt`、`language`。保证每条结论都能追溯回来源。
- 事件字段：`canonicalEvent.whatHappened`、`whyItMatters`、`affectedActors`、`evidence`、`confidence`。这是结构化抽取的核心，用来替代简单摘要。
- 分类字段：`category`、`eventType`、`taxonomy.topics`、`taxonomy.valueChain`、`maturity`。用于把不同来源的新闻统一映射到模型、算力、应用、工具、治理、市场等维度。
- 影响判断字段：`impact.score`、`horizon`、`stakeholders`、`risks`、`opportunities`。用于决定 Top Events、深度分析和风险/机会提示。
- 信号字段：`signals.novelty`、`adoption`、`technicalDepth`、`regulatoryWeight`、`capitalIntensity`。用于趋势聚合，不只是按词频统计。
- 实体字段：`entities.organizations`、`products`、`people`、`geographies`、`extracted`。用于跨文章聚合同一公司、模型、产品或地区。
- 审计字段：`confidenceScore`、`evidence[]`、`extractionMeta.method`、`promptVersion`、`validatedAt`、`warnings`。用于说明 AI 抽取是否可靠、是否通过校验、是否有异常。

## 4. 结构化抽取怎么做？

流程是：

1. 采集 RSS 数据，保留标题、摘要、正文、链接、来源、发布时间。
2. 清洗 HTML、统一时间、规范 URL，并按 URL/标题做去重。
3. 按批次把新闻送给 DeepSeek 做结构化抽取。当前配置是每批 20 条，并发 3 个批次。
4. 要求模型输出固定 JSON 结构，包括 category、event_type、entities、key_facts、impact_analysis、risk_signals、opportunity_signals、confidence_score、evidence。
5. 后端使用 Zod Schema 校验模型输出。模型输出不合法时，不直接入库。
6. 对模型常见漂移做宽容解析，例如 `stock/ticker/vendor` 会归一成 `company`，`mixed` language 会按原始语言修正。
7. 如果大批次 JSON 不稳定，系统会自动拆半重试，保证尽量保留 AI 抽取路径，而不是把坏结果写进报告。
8. 通过校验的结构化记录进入评分、趋势聚合、Top Events、深度分析和 PDF 报告。

## 5. 怎么根据数据源特点调整 Schema？

不同来源提供的信号不一样，所以 Schema 不是只服务摘要，而是服务多源融合：

- 官方源更适合提取产品、模型、平台、发布主体和可信事实，所以保留 `sourceType` 和 `confidence`。
- 研究源更适合提取技术方向和成熟度，所以有 `taxonomy.topics`、`maturity`、`technicalDepth`。
- 开发者源更适合提取工具链采用和社区反馈，所以有 `developer_tools`、`adoption`、`opportunitySignals`。
- 安全/政策源更适合提取风险，所以有 `riskSignals`、`regulatoryWeight`、`policy_regulation`、`safety_security`。
- 金融市场源更适合提取资本信号，所以有 `capital_market`、`capitalIntensity`、`market` value chain。

这样设计后，日报不是把新闻简单拼接成摘要，而是把不同来源的非结构化文本转成统一事件模型，再用同一套质量门、评分和聚合逻辑生成判断。

## 6. 面试时可以怎么概括亮点？

可以这样说：

“我没有把 AI 当成一个摘要工具，而是把它放进了可审计的数据管线里。数据源先按官方、媒体、研究、开发者、金融市场分层；每条新闻进入系统后，会被 DeepSeek 抽取成 schema-versioned 的事件对象，包括实体、事实、影响、风险、机会、置信度和证据。后端再用 Zod 做强校验和宽容归一，避免模型输出漂移直接污染报告。最后的 Top Events、趋势判断和风险机会不是从 raw summary 里拼出来的，而是基于结构化字段、影响分、来源类型、动量信号和资本市场验证信号聚合出来的。”
