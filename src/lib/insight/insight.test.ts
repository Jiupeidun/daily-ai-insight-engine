import { describe, expect, it } from "vitest";
import { extractDeterministic } from "./extract";
import { generateDailyReport } from "./report";
import { RawNewsItemSchema, type RawNewsItem } from "./schema";

function sampleRawNews(overrides: Partial<RawNewsItem> = {}): RawNewsItem {
  return RawNewsItemSchema.parse({
    id: "sample-001",
    title: "OpenAI launches new enterprise AI agent workflow",
    summary:
      "OpenAI introduced an enterprise AI agent workflow for developers and business teams, with governance controls and API integrations.",
    content:
      "The launch targets enterprise adoption, developer tools, and AI governance. Customers can connect the agent to internal workflows.",
    url: "https://example.com/openai-agent",
    sourceName: "Example AI News",
    sourceUrl: "https://example.com/feed.xml",
    sourceType: "official",
    publishedAt: "2026-07-06T00:00:00.000Z",
    collectedAt: "2026-07-06T01:00:00.000Z",
    language: "en",
    authors: [],
    rawTags: ["AI"],
    ...overrides
  });
}

describe("insight pipeline", () => {
  it("extracts a validated structured insight from one raw article", () => {
    const insight = extractDeterministic(sampleRawNews());

    expect(insight.rawId).toBe("sample-001");
    expect(insight.taxonomy.topics).toContain("developer_tools");
    expect(insight.impact.score).toBeGreaterThanOrEqual(70);
    expect(insight.canonicalEvent.evidence).toContain("OpenAI");
    expect(insight.extractionMeta.method).toBe("deterministic_fallback");
  });

  it("generates report sections and chart datasets from structured insights", () => {
    const articles = [
      extractDeterministic(sampleRawNews()),
      extractDeterministic(
        sampleRawNews({
          id: "sample-002",
          title: "Nvidia expands AI inference infrastructure for enterprises",
          summary:
            "Nvidia announced new GPU inference infrastructure for enterprise AI workloads and developer deployment.",
          url: "https://example.com/nvidia-inference",
          sourceName: "Example Infra News",
          sourceType: "tech_media"
        })
      )
    ];

    const report = generateDailyReport(articles, articles.length);

    expect(report.topEvents).toHaveLength(2);
    expect(report.charts.topicDistribution.length).toBeGreaterThan(0);
    expect(report.charts.signalRadar).toHaveLength(5);
    expect(report.qualityGates.some((gate) => gate.name === "Structured extraction coverage")).toBe(
      true
    );
  });
});
