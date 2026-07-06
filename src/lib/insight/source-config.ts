import type { SourceManifest } from "./schema";

export const NEWS_SOURCES: SourceManifest[] = [
  {
    id: "36kr-feed",
    name: "36Kr",
    url: "https://36kr.com/feed",
    type: "tech_media",
    languageHint: "zh",
    rationale:
      "Chinese tech and startup coverage adds local AI application, funding, and platform signals."
  },
  {
    id: "ithome-feed",
    name: "IT之家",
    url: "https://www.ithome.com/rss/",
    type: "tech_media",
    languageHint: "zh",
    rationale:
      "High-frequency Chinese technology feed useful for local product and platform updates."
  },
  {
    id: "techcrunch-ai",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Covers AI startups, platform launches, funding, and product-market signals with fast cadence."
  },
  {
    id: "the-verge-ai",
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/index.xml",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Consumer AI, platform strategy, product launches, and policy controversies from a high-signal tech newsroom."
  },
  {
    id: "wired-ai",
    name: "WIRED AI",
    url: "https://www.wired.com/feed/tag/ai/latest/rss",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Adds investigative and societal AI coverage that complements product and funding feeds."
  },
  {
    id: "venturebeat-ai",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Useful for enterprise AI adoption, developer platforms, and go-to-market movements."
  },
  {
    id: "ai-news",
    name: "AI News",
    url: "https://www.artificialintelligence-news.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "AI-specialized media source for product, enterprise adoption, governance, and infrastructure coverage."
  },
  {
    id: "marktechpost",
    name: "MarkTechPost",
    url: "https://www.marktechpost.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "High-cadence AI research and model release coverage useful for expanding the daily signal set."
  },
  {
    id: "infoworld",
    name: "InfoWorld",
    url: "https://www.infoworld.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Developer and enterprise software coverage that surfaces AI tooling and adoption signals."
  },
  {
    id: "google-deepmind",
    name: "Google DeepMind Blog",
    url: "https://www.deepmind.google/blog/rss.xml",
    type: "official",
    languageHint: "en",
    rationale:
      "Official research and model capability updates from Google DeepMind."
  },
  {
    id: "microsoft-ai",
    name: "Microsoft AI Platform Blog",
    url: "https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board?board.id=AIPlatformBlog",
    type: "official",
    languageHint: "en",
    rationale:
      "Enterprise AI, Copilot, infrastructure, and policy updates from a major platform vendor."
  },
  {
    id: "aws-ml",
    name: "AWS Machine Learning Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    type: "official",
    languageHint: "en",
    rationale:
      "Cloud AI deployment, enterprise machine learning, model operations, and infrastructure signals from AWS."
  },
  {
    id: "nvidia-ai",
    name: "NVIDIA AI Blog",
    url: "https://blogs.nvidia.com/blog/category/deep-learning/feed/",
    type: "official",
    languageHint: "en",
    rationale:
      "Compute, infrastructure, model serving, and AI industry adoption signals from NVIDIA."
  },
  {
    id: "nvidia-developer",
    name: "NVIDIA Developer Blog",
    url: "https://developer.nvidia.com/blog/feed/",
    type: "official",
    languageHint: "en",
    rationale:
      "Technical AI infrastructure, GPU software, CUDA, inference, and developer platform signals from NVIDIA."
  },
  {
    id: "meta-engineering",
    name: "Meta Engineering",
    url: "https://engineering.fb.com/feed/",
    type: "official",
    languageHint: "en",
    rationale:
      "Official engineering updates covering AI infrastructure, open models, recommendation systems, and production platforms."
  },
  {
    id: "databricks",
    name: "Databricks Blog",
    url: "https://www.databricks.com/feed",
    type: "official",
    languageHint: "en",
    rationale:
      "Enterprise data and AI platform updates relevant to AI infrastructure, lakehouse, and model operations."
  },
  {
    id: "mit-tr-ai",
    name: "MIT Technology Review AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Adds slower but higher-signal context for technical, policy, and societal impact analysis."
  },
  {
    id: "ieee-spectrum-ai",
    name: "IEEE Spectrum AI",
    url: "https://spectrum.ieee.org/rss/artificial-intelligence/fulltext",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Engineering-heavy AI coverage that adds robotics, chips, systems, and applied research signals."
  },
  {
    id: "dark-reading",
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Security-focused feed for AI risk, cyber misuse, identity, and enterprise defense signals."
  },
  {
    id: "cso-online",
    name: "CSO Online",
    url: "https://www.csoonline.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Enterprise security and governance source for AI risk and compliance-related signals."
  },
  {
    id: "computerworld",
    name: "Computerworld",
    url: "https://www.computerworld.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Enterprise IT source for AI productivity, workplace, and platform adoption signals."
  },
  {
    id: "zdnet-ai",
    name: "ZDNET AI",
    url: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Enterprise AI products, productivity tooling, security, and buyer-facing technology coverage."
  },
  {
    id: "techradar-ai",
    name: "TechRadar AI",
    url: "https://www.techradar.com/rss/news/computing/artificial-intelligence",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Consumer and productivity AI product coverage with fast cadence."
  },
  {
    id: "mit-news-ai",
    name: "MIT News AI",
    url: "https://news.mit.edu/rss/topic/artificial-intelligence2",
    type: "research",
    languageHint: "en",
    rationale:
      "Research and institutional AI coverage from MIT for academic and applied signals."
  },
  {
    id: "science-daily-ai",
    name: "ScienceDaily AI",
    url: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml",
    type: "research",
    languageHint: "en",
    rationale:
      "Broad academic AI research stream useful for early technical and scientific application signals."
  },
  {
    id: "the-decoder",
    name: "The Decoder",
    url: "https://the-decoder.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "AI-specialized coverage gives high density model, product, and research updates."
  },
  {
    id: "openai-news",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    type: "official",
    languageHint: "en",
    rationale:
      "Official release notes and product announcements reduce second-hand interpretation noise."
  },
  {
    id: "arxiv-cs-ai",
    name: "arXiv cs.AI",
    url: "https://export.arxiv.org/rss/cs.AI",
    type: "research",
    languageHint: "en",
    rationale:
      "Research stream for emerging technical ideas before they show up in products."
  },
  {
    id: "bair-blog",
    name: "Berkeley AI Research",
    url: "https://bair.berkeley.edu/blog/feed.xml",
    type: "research",
    languageHint: "en",
    rationale:
      "Academic research commentary that improves coverage of emerging methods and safety questions."
  },
  {
    id: "simon-willison",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    type: "developer",
    languageHint: "en",
    rationale:
      "Developer-focused LLM tooling, model behavior, and practical AI engineering analysis."
  },
  {
    id: "latent-space",
    name: "Latent Space",
    url: "https://www.latent.space/feed",
    type: "developer",
    languageHint: "en",
    rationale:
      "AI engineer and founder ecosystem signal for models, agents, infrastructure, and developer workflows."
  },
  {
    id: "kdnuggets",
    name: "KDnuggets",
    url: "https://www.kdnuggets.com/feed",
    type: "developer",
    languageHint: "en",
    rationale:
      "Data science and machine learning practitioner source for applied AI and tooling signals."
  },
  {
    id: "machine-learning-mastery",
    name: "Machine Learning Mastery",
    url: "https://machinelearningmastery.com/feed/",
    type: "developer",
    languageHint: "en",
    rationale:
      "Applied machine learning source for developer and practitioner education signals."
  },
  {
    id: "towards-data-science",
    name: "Towards Data Science",
    url: "https://towardsdatascience.com/feed",
    type: "developer",
    languageHint: "en",
    rationale:
      "Practitioner essays and technical posts for AI engineering, data science, and model operations."
  },
  {
    id: "semi-analysis",
    name: "SemiAnalysis",
    url: "https://www.semianalysis.com/feed",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "AI semiconductor, GPU cluster, data center, and capital expenditure analysis relevant to AI market structure."
  },
  {
    id: "tomshardware",
    name: "Tom's Hardware",
    url: "https://www.tomshardware.com/feeds/all",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Hardware, GPU, memory, and data center component coverage that captures AI infrastructure market signals."
  },
  {
    id: "serve-the-home",
    name: "ServeTheHome",
    url: "https://www.servethehome.com/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Server, accelerator, networking, and data center hardware coverage relevant to AI infrastructure."
  },
  {
    id: "storage-review",
    name: "StorageReview",
    url: "https://www.storagereview.com/feed",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Storage and infrastructure benchmarks that capture AI workload hardware signals."
  },
  {
    id: "datacenter-knowledge",
    name: "Data Center Knowledge",
    url: "https://www.datacenterknowledge.com/rss.xml",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Data center capacity, power, cooling, and cloud infrastructure signals driven by AI demand."
  },
  {
    id: "wsj-markets",
    name: "WSJ Markets",
    url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Market-moving finance coverage for AI-linked equities, chips, cloud, data centers, and capital allocation."
  },
  {
    id: "hn-ai",
    name: "Hacker News AI Search",
    url: "https://hnrss.org/newest?q=AI",
    type: "aggregator",
    languageHint: "en",
    rationale:
      "Developer-community discussion proxy that surfaces tools and controversies early."
  }
];

export const SOURCE_MANIFEST = {
  generatedFor: "Daily AI Insight Engine",
  selectionLogic: [
    "Blend primary official sources with media and developer-community sources.",
    "Prefer RSS feeds because they are reproducible, timestamped, and easy to audit.",
    "Include research and tooling feeds so the report is not limited to product launch summaries.",
    "Keep source types explicit so the report can separate official claims from third-party interpretation."
  ],
  sources: NEWS_SOURCES
};
