import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { DailyReport } from "../insight/schema";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.x = doc.page.margins.left;
  doc.font("Helvetica").fontSize(14).fillColor("#111827").text(title);
  doc
    .moveTo(doc.x, doc.y + 3)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 3)
    .strokeColor("#d9e1ea")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.6);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc.font("Helvetica").fontSize(9.5).fillColor("#374151").text(text, {
    lineGap: 3,
    ...options
  });
}

function metric(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.roundedRect(x, y, width, 56, 6).fillAndStroke("#f8fafc", "#d9e1ea");
  doc.font("Helvetica").fontSize(7.5).fillColor("#64748b").text(label.toUpperCase(), x + 10, y + 10, {
    width: width - 20
  });
  doc.font("Helvetica").fontSize(17).fillColor("#111827").text(value, x + 10, y + 27, {
    width: width - 20
  });
}

function topEvent(doc: PDFKit.PDFDocument, rank: number, score: number, title: string, body: string) {
  const startY = doc.y;
  doc
    .roundedRect(
      doc.page.margins.left,
      startY,
      doc.page.width - doc.page.margins.left - doc.page.margins.right,
      72,
      6
    )
    .fillAndStroke("#ffffff", "#e5e7eb");
  doc.font("Helvetica").fontSize(16).fillColor("#0b6bcb").text(String(rank), doc.page.margins.left + 12, startY + 12, {
    width: 28
  });
  doc.font("Helvetica").fontSize(10).fillColor("#111827").text(title, doc.page.margins.left + 48, startY + 12, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 110,
    lineGap: 2
  });
  doc.font("Helvetica").fontSize(8.5).fillColor("#64748b").text(body, doc.page.margins.left + 48, startY + 36, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 74,
    height: 28,
    lineGap: 2
  });
  doc.font("Helvetica").fontSize(16).fillColor("#168a3a").text(String(score), doc.page.width - doc.page.margins.right - 42, startY + 14, {
    width: 36,
    align: "right"
  });
  doc.y = startY + 82;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

export function renderDailyReportPdf(report: DailyReport) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: {
        Title: "AI 舆情分析日报",
        Author: "Daily AI Insight Engine",
        Subject: "Daily AI public opinion and intelligence report"
      }
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica");

    doc.rect(0, 0, doc.page.width, 118).fill("#101116");
    doc.fontSize(21).fillColor("#ffffff").text("AI 舆情分析日报", 42, 38);
    doc.fontSize(11).fillColor("#b8b8bf").text("Daily AI Insight Report", 42, 66);
    doc
      .fontSize(8.5)
      .fillColor("#9b9ba1")
      .text(
        `Generated ${formatDateTime(report.generatedAt)} · ${report.sourceStats.structuredCount} structured items · ${report.sourceStats.sourceCount} sources`,
        42,
        91
      );

    doc.y = 138;
    section(doc, "Executive Brief / 执行摘要");
    paragraph(doc, report.executiveBrief);

    section(doc, "Key Metrics / 核心指标");
    const metricWidth = 118;
    const metricGap = 10;
    const y = doc.y;
    metric(doc, "Structured", String(report.sourceStats.structuredCount), 42, y, metricWidth);
    metric(doc, "Sources", String(report.sourceStats.sourceCount), 42 + (metricWidth + metricGap), y, metricWidth);
    metric(
      doc,
      "ZH / Mixed",
      `${report.sourceStats.languageMix.zh + report.sourceStats.languageMix.mixed}/${report.sourceStats.structuredCount}`,
      42 + (metricWidth + metricGap) * 2,
      y,
      metricWidth
    );
    metric(doc, "Raw", String(report.sourceStats.rawCount), 42 + (metricWidth + metricGap) * 3, y, metricWidth);
    doc.y = y + 72;

    section(doc, "Top Events / 今日热点");
    for (const event of report.topEvents) {
      ensureSpace(doc, 88);
      topEvent(doc, event.rank, event.score, event.title, event.whyImportant);
    }

    section(doc, "Trend Radar / 趋势雷达");
    for (const trend of report.trendRadar) {
      ensureSpace(doc, 34);
      paragraph(
        doc,
        `${trend.theme} · ${trend.direction.toUpperCase()} · ${Math.round(trend.intensity)} - ${trend.rationale}`
      );
      doc.moveDown(0.25);
    }

    section(doc, "Deep Dives / 深度分析");
    for (const item of report.deepDives) {
      ensureSpace(doc, 74);
      doc.fontSize(10.5).fillColor("#111827").text(item.headline, { lineGap: 2 });
      paragraph(doc, `Impact: ${item.impact}`);
      paragraph(doc, `Watch next: ${item.watchNext}`);
      doc.moveDown(0.45);
    }

    section(doc, "Methodology / 方法论");
    for (const [index, item] of report.methodology.entries()) {
      ensureSpace(doc, 34);
      paragraph(doc, `${index + 1}. ${item.step}: ${item.detail}`);
      doc.moveDown(0.2);
    }

    const pageCount = doc.bufferedPageRange().count;
    for (let index = 0; index < pageCount; index += 1) {
      doc.switchToPage(index);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#8a92a0")
        .text(
          `© 2026 Kkertin. All rights reserved. · Contact: kkertin1214@gmail.com · ${index + 1}/${pageCount}`,
          42,
          doc.page.height - 30,
          { align: "center", width: doc.page.width - 84 }
        );
    }

    doc.end();
  });
}
