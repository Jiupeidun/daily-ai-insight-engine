import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { ArticleInsight, DailyReport, Topic } from "../insight/schema";

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

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

function directionLabel(direction: string) {
  if (direction === "up" || direction === "rising") return "Rising";
  if (direction === "down" || direction === "cooling") return "Cooling";
  return "Stable";
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

function trendDimension(theme: string) {
  if (theme === "frontier_model" || theme === "ai_infrastructure" || theme === "research" || theme === "open_source") {
    return "Technology";
  }
  if (theme === "product_launch" || theme === "enterprise_adoption" || theme === "developer_tools") {
    return "Application";
  }
  if (theme === "policy_regulation" || theme === "safety_security") {
    return "Policy";
  }
  return "Capital";
}

function trendRow(doc: PDFKit.PDFDocument, trend: DailyReport["trendRadar"][number]) {
  const label = `${trendDimension(trend.theme)} - ${topicLabel(trend.theme)} - ${directionLabel(trend.direction)} (${trend.intensity}/100)`;
  const text = `${label}: ${sentence(trend.rationale)}`;
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
        `Generated ${formatDateTime(report.generatedAt)} - ${report.sourceStats.structuredCount} structured items - ${report.sourceStats.sourceCount} sources - ${report.sourceStats.sourceTypeMix.financial ?? 0} financial signals`,
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
    smallText(doc, "The trend radar groups validated events into technology, application, policy, and capital dimensions. Direction is based on momentum, impact, and source-weighted evidence.");
    doc.moveDown(0.4);
    for (const trend of report.trendRadar.slice(0, 6)) {
      trendRow(doc, trend);
    }

    if (report.charts.momentumSignals.length > 0) {
      section(doc, "Momentum Signals");
      for (const signal of report.charts.momentumSignals.slice(0, 5)) {
        const text = `${signal.type === "entity" ? "Entity" : "Topic"} - ${topicLabel(String(signal.signal))}: ${directionLabel(String(signal.direction))} (${signal.momentumScore}/100). ${sentence(String(signal.rationale))}`;
        paragraph(doc, text);
        doc.moveDown(0.15);
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
