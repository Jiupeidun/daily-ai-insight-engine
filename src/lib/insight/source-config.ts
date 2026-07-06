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
    id: "venturebeat-ai",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/category/ai/feed/",
    type: "tech_media",
    languageHint: "en",
    rationale:
      "Useful for enterprise AI adoption, developer platforms, and go-to-market movements."
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
    id: "anthropic-news",
    name: "Anthropic News",
    url: "https://www.anthropic.com/news/rss.xml",
    type: "official",
    languageHint: "en",
    rationale:
      "Official source for Claude, safety, enterprise, and policy updates."
  },
  {
    id: "google-deepmind",
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/discover/blog/rss.xml",
    type: "official",
    languageHint: "en",
    rationale:
      "Primary source for Google DeepMind model, research, and scientific AI releases."
  },
  {
    id: "huggingface-blog",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    type: "developer",
    languageHint: "en",
    rationale:
      "Developer ecosystem signal for open models, datasets, tooling, and deployment patterns."
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
