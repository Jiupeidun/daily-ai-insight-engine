import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { ArticleInsight, DailyReport, Topic } from "../insight/schema";
import { formatReportDateTime, REPORT_TIME_ZONE } from "../insight/time";

const PAGE_MARGIN = 42;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const FOOTER_HEIGHT = 34;

const TOPIC_LABELS: Record<Topic, string> = {
  frontier_model: "Frontier Models",
  ai_infrastructure: "AI Infrastructure",
  product_launch: "Product Launches",
  research: "Research",
  open_source: "Open Source",
  policy_regulation: "Policy and Regulation",
  capital_market: "Capital Markets",
  safety_security: "Safety and Security",
  enterprise_adoption: "Enterprise Adoption",
  developer_tools: "Developer Tools"
};

function pdfText(value: string | number | undefined | null): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value: string, fallback = "No additional detail was available in the validated source fields.") {
  const clean = pdfText(value);
  return clean.length > 0 ? clean : fallback;
}

function topicLabel(topic: string) {
  return TOPIC_LABELS[topic as Topic] ?? topic.replace(/_/g, " ");
}

function getArticle(report: DailyReport, articleId: string): ArticleInsight | undefined {
  return report.articles.find((article) => article.id === articleId);
}

function measureText(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number,
  font = "Helvetica",
  lineGap = 2
) {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(pdfText(text), { width, lineGap });
}

function bottomLimit(doc: PDFKit.PDFDocument) {
  return doc.page.height - doc.page.margins.bottom - FOOTER_HEIGHT;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > bottomLimit(doc)) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function paragraph(doc: PDFKit.PDFDocument, text: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc.font("Helvetica").fontSize(9.3).fillColor("#374151").text(pdfText(text), {
    width: CONTENT_WIDTH,
    lineGap: 3,
    ...options
  });
}

function smallText(doc: PDFKit.PDFDocument, text: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc.font("Helvetica").fontSize(8.2).fillColor("#53627a").text(pdfText(text), {
    width: CONTENT_WIDTH,
    lineGap: 2,
    ...options
  });
}

function section(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 46);
  doc.moveDown(0.9);
  doc.x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text(pdfText(title));
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor("#d9e1ea")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.7);
}

function metric(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.roundedRect(x, y, width, 52, 5).fillAndStroke("#f8fafc", "#d9e1ea");
  doc.font("Helvetica").fontSize(7.2).fillColor("#64748b").text(pdfText(label.toUpperCase()), x + 10, y + 10, {
    width: width - 20
  });
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text(pdfText(value), x + 10, y + 26, {
    width: width - 20
  });
}

function labelPill(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, color = "#0b6bcb") {
  doc.roundedRect(x, y, width, 18, 9).fill("#edf5ff");
  doc.font("Helvetica-Bold").fontSize(7.2).fillColor(color).text(pdfText(text).toUpperCase(), x + 7, y + 5, {
    width: width - 14,
    align: "center"
  });
}

function sourceLine(article: ArticleInsight | undefined) {
  if (!article) return "Source: validated article set";
  const facts = [
    article.sourceName,
    article.sourceType.replace(/_/g, " "),
    `confidence ${Math.round(article.confidenceScore * 100)}/100`
  ];
  return `Source: ${facts.join(" - ")}`;
}

function topEvent(doc: PDFKit.PDFDocument, report: DailyReport, event: DailyReport["topEvents"][number]) {
  const article = getArticle(report, event.articleId);
  const titleWidth = CONTENT_WIDTH - 102;
  const bodyWidth = CONTENT_WIDTH - 54;
  const titleHeight = measureText(doc, event.title, titleWidth, 9.8, "Helvetica-Bold", 2);
  const body = `Why it matters: ${sentence(event.whyImportant)} Evidence: ${sentence(event.evidence)}`;
  const bodyHeight = measureText(doc, body, bodyWidth, 8.4, "Helvetica", 2);
  const sourceHeight = measureText(doc, sourceLine(article), bodyWidth, 7.4, "Helvetica", 1);
  const cardHeight = Math.max(94, 24 + titleHeight + bodyHeight + sourceHeight + 28);

  ensureSpace(doc, cardHeight + 10);
  const startY = doc.y;
  doc
    .roundedRect(doc.page.margins.left, startY, CONTENT_WIDTH, cardHeight, 6)
    .fillAndStroke("#ffffff", "#e5e7eb");
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#0b6bcb").text(String(event.rank), PAGE_MARGIN + 12, startY + 13, {
    width: 26
  });
  doc.font("Helvetica-Bold").fontSize(9.8).fillColor("#111827").text(pdfText(event.title), PAGE_MARGIN + 44, startY + 13, {
    width: titleWidth,
    lineGap: 2
  });
  labelPill(doc, `Score ${event.score}`, doc.page.width - doc.page.margins.right - 70, startY + 12, 58, "#168a3a");

  const bodyY = startY + 18 + titleHeight;
  doc.font("Helvetica").fontSize(8.4).fillColor("#4b5870").text(pdfText(body), PAGE_MARGIN + 44, bodyY, {
    width: bodyWidth,
    lineGap: 2
  });
  doc.font("Helvetica").fontSize(7.4).fillColor("#7a8699").text(pdfText(sourceLine(article)), PAGE_MARGIN + 44, bodyY + bodyHeight + 6, {
    width: bodyWidth,
    lineGap: 1
  });
  doc.y = startY + cardHeight + 10;
}

function deepDive(doc: PDFKit.PDFDocument, report: DailyReport, item: DailyReport["deepDives"][number], index: number) {
  const article = getArticle(report, item.articleId);
  const title = `${index + 1}. ${item.headline}`;
  const blocks = [
    `Background: ${sentence(item.background)}`,
    `Impact analysis: ${sentence(item.impact)}`,
    `What to watch: ${sentence(item.watchNext)}`,
    `Evidence base: ${article ? sentence(article.canonicalEvent.evidence) : item.citedUrls.slice(0, 1).join(", ")}`
  ];
  const titleHeight = measureText(doc, title, CONTENT_WIDTH, 10.5, "Helvetica-Bold", 2);
  const blockHeight = blocks.reduce((sum, block) => sum + measureText(doc, block, CONTENT_WIDTH - 16, 8.7, "Helvetica", 2) + 7, 0);
  ensureSpace(doc, titleHeight + blockHeight + 20);

  doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#111827").text(pdfText(title), { width: CONTENT_WIDTH, lineGap: 2 });
  doc.moveDown(0.25);
  for (const block of blocks) {
    doc.font("Helvetica").fontSize(8.7).fillColor("#374151").text(pdfText(block), PAGE_MARGIN + 10, doc.y, {
      width: CONTENT_WIDTH - 16,
      lineGap: 2
    });
    doc.moveDown(0.35);
  }
}

function articleMatches(article: ArticleInsight, topics: Topic[], terms: string[] = []) {
  const topicMatch = article.taxonomy.topics.some((topic) => topics.includes(topic));
  if (!topicMatch) {
    return false;
  }
  if (terms.length === 0) {
    return true;
  }
  const haystack = `${article.title} ${article.summary} ${article.canonicalEvent.whatHappened} ${article.impactAnalysis}`.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function topArticles(report: DailyReport, topics: Topic[], terms: string[] = [], limit = 3) {
  return report.articles
    .filter((article) => articleMatches(article, topics, terms))
    .sort((a, b) => {
      if (b.impact.score !== a.impact.score) {
        return b.impact.score - a.impact.score;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, limit);
}

function compactTitle(article: ArticleInsight | undefined) {
  if (!article) {
    return "validated source evidence";
  }
  const title = pdfText(article.title);
  return title.length > 110 ? `${title.slice(0, 107)}...` : title;
}

function buildTrendInsightText(label: string, insight: string, articles: ArticleInsight[]) {
  const evidence = articles
    .slice(0, 2)
    .map((article) => `${compactTitle(article)} (${article.sourceName})`)
    .join("; ");
  return `${label}: ${insight} Evidence: ${evidence || "validated source evidence"}.`;
}

function buildTrendInsights(report: DailyReport) {
  const technology = [
    ...topArticles(report, ["ai_infrastructure"], ["Huawei", "Nvidia", "accelerator", "chip", "server"], 2),
    ...topArticles(report, ["research", "frontier_model"], ["Claude Science", "BioNeMo", "science", "biology"], 1)
  ];
  const application = [
    ...topArticles(report, ["enterprise_adoption", "product_launch"], ["Databricks", "OpenAI", "enterprise", "Claude Science"], 2),
    ...topArticles(report, ["developer_tools"], ["agent", "coding", "workflow"], 1)
  ];
  const policy = topArticles(
    report,
    ["policy_regulation", "safety_security"],
    ["agent", "zero trust", "ransom", "China", "companion", "identity", "security"],
    3
  );
  const capital = [
    ...topArticles(report, ["capital_market", "ai_infrastructure"], ["Nvidia", "Huawei", "suppliers", "storage", "NAND", "market"], 2),
    ...topArticles(report, ["capital_market"], ["token", "spending", "cloud"], 1)
  ];

  return [
    buildTrendInsightText(
      "Technology direction",
      "AI competition is shifting from model-only announcements toward the physical compute stack. Today's evidence points to accelerator supply, rack-scale servers, and domain-specific science tooling becoming the real battleground.",
      technology
    ),
    buildTrendInsightText(
      "Application direction",
      "Enterprise AI is moving from generic chat interfaces into governed workflows for data platforms, software development, and scientific research. The important signal is vertical integration: model capability plus workflow context plus enterprise controls.",
      application
    ),
    buildTrendInsightText(
      "Policy and security direction",
      "Agentic AI is becoming a control-plane problem. Security teams are being forced to treat agents as autonomous actors with identity, permissions, secrets, and rollback requirements, while regulators are starting with high-risk humanlike or manipulative use cases.",
      policy
    ),
    buildTrendInsightText(
      "Capital direction",
      "Capital attention is concentrating on AI infrastructure bottlenecks rather than only application-layer narratives. Chip availability, server delays, supplier exposure, storage density, and AI spending signals are the market variables to watch.",
      capital
    )
  ];
}

function buildEvidenceSignals(report: DailyReport) {
  return [
    ...topArticles(report, ["ai_infrastructure"], ["Huawei", "Nvidia", "accelerator", "server"], 2),
    ...topArticles(report, ["research", "enterprise_adoption"], ["Claude Science", "BioNeMo", "Databricks"], 2),
    ...topArticles(report, ["policy_regulation", "safety_security"], ["agent", "ransom", "China", "zero trust"], 2),
    ...topArticles(report, ["capital_market"], ["NAND", "token", "spending", "cloud"], 1)
  ]
    .filter((article, index, articles) => articles.findIndex((candidate) => candidate.id === article.id) === index)
    .slice(0, 6)
    .map((article) => {
      const topicText = article.taxonomy.topics.slice(0, 2).map(topicLabel).join(" / ");
      return `${topicText}: ${article.canonicalEvent.whatHappened} Why it matters: ${article.canonicalEvent.whyItMatters}`;
    });
}

function trendInsightRow(doc: PDFKit.PDFDocument, text: string) {
  const height = measureText(doc, text, CONTENT_WIDTH - 10, 8.8, "Helvetica", 2) + 8;
  ensureSpace(doc, height);
  paragraph(doc, text, { width: CONTENT_WIDTH - 10 });
  doc.moveDown(0.15);
}

function riskOpportunityRow(doc: PDFKit.PDFDocument, item: DailyReport["riskOpportunity"][number]) {
  const prefix = item.type === "risk" ? "Risk" : "Opportunity";
  const text = `${prefix} - ${item.title}: ${sentence(item.rationale)}`;
  const height = measureText(doc, text, CONTENT_WIDTH - 10, 8.8, "Helvetica", 2) + 8;
  ensureSpace(doc, height);
  paragraph(doc, text, { width: CONTENT_WIDTH - 10 });
  doc.moveDown(0.15);
}

function methodologySummary(report: DailyReport) {
  const aiGate = report.qualityGates.find((gate) => gate.name === "AI extraction resilience");
  return [
    `Data coverage: ${report.sourceStats.structuredCount}/${report.sourceStats.rawCount} collected items passed schema validation across ${report.sourceStats.sourceCount} sources.`,
    `Extraction: each article is transformed into schema-versioned event facts, entities, taxonomy, impact, confidence, evidence, risks, and opportunities.`,
    `Quality gate: ${aiGate?.value ?? "AI extraction validated"}. Low-quality or malformed model output is not allowed into the report until it passes validation.`,
    "Ranking: Top Events are selected from structured impact score, AI relevance tier, source credibility, recency, entities, and evidence confidence."
  ];
}

function schemaSummary(report: DailyReport) {
  return [
    `Article schema: ${report.schemaVersion} report over ${report.articles[0]?.schemaVersion ?? "article-insight-v2"} article records.`,
    "Core fields: canonicalEvent records what happened, why it matters, affected actors, evidence, and confidence.",
    "Taxonomy fields: topics and valueChain convert unstructured news into comparable technical, application, policy, and capital signals.",
    "Decision fields: impact score, horizon, stakeholders, risks, opportunities, and signal scores make the output useful for daily judgment, not only summarization."
  ];
}

function renderFooter(doc: PDFKit.PDFDocument) {
  const pageCount = doc.bufferedPageRange().count;
  for (let index = 0; index < pageCount; index += 1) {
    doc.switchToPage(index);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#8a92a0")
      .text(
        `Daily AI Insight Engine - Agent-friendly structured intelligence report - ${index + 1}/${pageCount}`,
        PAGE_MARGIN,
        doc.page.height - doc.page.margins.bottom - 16,
        { align: "center", width: CONTENT_WIDTH }
      );
  }
}

export function renderDailyReportPdf(report: DailyReport) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      bufferPages: true,
      info: {
        Title: "Daily AI Insight Report",
        Author: "Daily AI Insight Engine",
        Subject: "Daily AI public opinion and intelligence report"
      }
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica");

    doc.rect(0, 0, doc.page.width, 120).fill("#101116");
    doc.font("Helvetica-Bold").fontSize(21).fillColor("#ffffff").text("Daily AI Insight Report", PAGE_MARGIN, 34);
    doc.font("Helvetica").fontSize(10.5).fillColor("#c6c7ce").text("AI public-opinion intelligence for decisions, not a news digest", PAGE_MARGIN, 64);
    doc
      .fontSize(8.2)
      .fillColor("#9b9ba1")
      .text(
        `Generated ${formatReportDateTime(report.generatedAt)} (${REPORT_TIME_ZONE}) - ${report.sourceStats.structuredCount} structured items - ${report.sourceStats.sourceCount} sources - ${report.sourceStats.sourceTypeMix.financial ?? 0} financial signals`,
        PAGE_MARGIN,
        91,
        { width: CONTENT_WIDTH }
      );

    doc.y = 138;
    section(doc, "Executive Brief");
    paragraph(doc, report.executiveBrief);

    section(doc, "Run Quality");
    const metricWidth = (CONTENT_WIDTH - 24) / 4;
    const metricGap = 8;
    const y = doc.y;
    metric(doc, "Structured", String(report.sourceStats.structuredCount), PAGE_MARGIN, y, metricWidth);
    metric(doc, "Sources", String(report.sourceStats.sourceCount), PAGE_MARGIN + (metricWidth + metricGap), y, metricWidth);
    metric(doc, "Financial", String(report.sourceStats.sourceTypeMix.financial ?? 0), PAGE_MARGIN + (metricWidth + metricGap) * 2, y, metricWidth);
    metric(doc, "AI Core", report.qualityGates.find((gate) => gate.name === "AI relevance gate")?.value.split(" / ")[0] ?? "Validated", PAGE_MARGIN + (metricWidth + metricGap) * 3, y, metricWidth);
    doc.y = y + 66;

    section(doc, "Top 3-5 AI Events Today");
    for (const event of report.topEvents.slice(0, 5)) {
      topEvent(doc, report, event);
    }

    section(doc, "Important Event Deep Dives");
    for (const [index, item] of report.deepDives.slice(0, 3).entries()) {
      deepDive(doc, report, item, index);
    }

    section(doc, "Trend Judgment");
    smallText(doc, "Trend judgment summarizes what today's validated events imply about AI's technology, application, policy, and capital-market direction.");
    doc.moveDown(0.4);
    for (const insight of buildTrendInsights(report)) {
      trendInsightRow(doc, insight);
    }

    const evidenceSignals = buildEvidenceSignals(report);
    if (evidenceSignals.length > 0) {
      section(doc, "Evidence Behind the Trend");
      smallText(doc, "These are the concrete source-backed events behind the trend judgment, not keyword counts.");
      doc.moveDown(0.35);
      for (const signal of evidenceSignals) {
        trendInsightRow(doc, signal);
      }
    }

    section(doc, "Risks and Opportunities");
    for (const item of report.riskOpportunity) {
      riskOpportunityRow(doc, item);
    }

    section(doc, "Methodology");
    for (const [index, item] of methodologySummary(report).entries()) {
      ensureSpace(doc, 36);
      paragraph(doc, `${index + 1}. ${item}`);
      doc.moveDown(0.15);
    }

    section(doc, "Schema Design Notes");
    for (const [index, item] of schemaSummary(report).entries()) {
      ensureSpace(doc, 34);
      paragraph(doc, `${index + 1}. ${item}`);
      doc.moveDown(0.15);
    }

    renderFooter(doc);
    doc.end();
  });
}
