import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DailyReport } from "../src/lib/insight/schema";

type TextLine = {
  text: string;
  size: number;
  color?: [number, number, number];
  gapAfter?: number;
};

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "data/reports/latest.json");
const OUTPUT_DIR = path.join(ROOT, "public/reports");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "latest-ai-insight-report.pdf");
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 42;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function readReport(): DailyReport {
  return JSON.parse(readFileSync(REPORT_PATH, "utf8")) as DailyReport;
}

function visualWidth(input: string) {
  return Array.from(input).reduce((width, char) => {
    const code = char.codePointAt(0) ?? 0;
    if (char === " ") {
      return width + 0.5;
    }
    return width + (code > 255 ? 2 : 1);
  }, 0);
}

function wrapText(input: string, maxUnits: number): string[] {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const token of normalized.split(" ")) {
    const tokenWidth = visualWidth(token);
    if (current !== "" && currentWidth + tokenWidth + 0.5 > maxUnits) {
      lines.push(current);
      current = token;
      currentWidth = tokenWidth;
      continue;
    }
    current = current === "" ? token : `${current} ${token}`;
    currentWidth += tokenWidth + (current === token ? 0 : 0.5);
  }

  if (current !== "") {
    lines.push(current);
  }
  return lines;
}

function addWrapped(lines: TextLine[], text: string, size: number, options: Omit<TextLine, "text" | "size"> = {}) {
  const maxUnits = Math.max(18, Math.floor(CONTENT_WIDTH / (size * 0.56)));
  for (const wrapped of wrapText(text, maxUnits)) {
    lines.push({ text: wrapped, size, color: options.color, gapAfter: options.gapAfter });
  }
}

function buildLines(report: DailyReport): TextLine[] {
  const lines: TextLine[] = [];
  const generated = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(report.generatedAt));

  lines.push({ text: "AI 舆情分析日报 / Daily AI Insight Report", size: 22, color: [0.05, 0.07, 0.1], gapAfter: 10 });
  lines.push({
    text: `Generated ${generated} · ${report.sourceStats.structuredCount} structured items · ${report.sourceStats.sourceCount} sources`,
    size: 9,
    color: [0.35, 0.39, 0.45],
    gapAfter: 16
  });

  lines.push({ text: "Executive Brief", size: 14, color: [0.05, 0.07, 0.1], gapAfter: 6 });
  addWrapped(lines, report.executiveBrief, 10, { color: [0.2, 0.23, 0.29], gapAfter: 14 });

  lines.push({ text: "Key Metrics", size: 14, color: [0.05, 0.07, 0.1], gapAfter: 6 });
  lines.push({
    text: `Structured: ${report.sourceStats.structuredCount} · Raw: ${report.sourceStats.rawCount} · ZH/Mixed: ${
      report.sourceStats.languageMix.zh + report.sourceStats.languageMix.mixed
    }/${report.sourceStats.structuredCount}`,
    size: 10,
    color: [0.2, 0.23, 0.29],
    gapAfter: 14
  });

  lines.push({ text: "Top Events", size: 14, color: [0.05, 0.07, 0.1], gapAfter: 6 });
  for (const event of report.topEvents) {
    addWrapped(lines, `${event.rank}. [${event.score}] ${event.title}`, 11, {
      color: [0.05, 0.07, 0.1],
      gapAfter: 2
    });
    addWrapped(lines, event.whyImportant, 9, { color: [0.32, 0.35, 0.4], gapAfter: 8 });
  }

  lines.push({ text: "Trend Radar", size: 14, color: [0.05, 0.07, 0.1], gapAfter: 6 });
  for (const trend of report.trendRadar) {
    addWrapped(lines, `${trend.theme}: ${trend.direction.toUpperCase()} ${Math.round(trend.intensity)} · ${trend.rationale}`, 9, {
      color: [0.25, 0.28, 0.34],
      gapAfter: 5
    });
  }

  lines.push({ text: "Deep Dives", size: 14, color: [0.05, 0.07, 0.1], gapAfter: 6 });
  for (const item of report.deepDives) {
    addWrapped(lines, item.headline, 11, { color: [0.05, 0.07, 0.1], gapAfter: 2 });
    addWrapped(lines, `Impact: ${item.impact}`, 9, { color: [0.32, 0.35, 0.4], gapAfter: 4 });
    addWrapped(lines, `Watch next: ${item.watchNext}`, 9, { color: [0.32, 0.35, 0.4], gapAfter: 8 });
  }

  lines.push({ text: "Methodology", size: 14, color: [0.05, 0.07, 0.1], gapAfter: 6 });
  for (const [index, item] of report.methodology.entries()) {
    addWrapped(lines, `${index + 1}. ${item.step}: ${item.detail}`, 9, {
      color: [0.25, 0.28, 0.34],
      gapAfter: 5
    });
  }

  return lines;
}

function utf16BeHex(input: string) {
  const littleEndian = Buffer.from(input, "utf16le");
  const bytes: number[] = [];
  for (let index = 0; index < littleEndian.length; index += 2) {
    bytes.push(littleEndian[index + 1] ?? 0, littleEndian[index] ?? 0);
  }
  return Buffer.from(bytes).toString("hex").toUpperCase();
}

function streamText(line: TextLine, x: number, y: number) {
  const color = line.color ?? [0.1, 0.12, 0.16];
  return [
    `${color[0]} ${color[1]} ${color[2]} rg`,
    "BT",
    `/F1 ${line.size} Tf`,
    `${x} ${y} Td`,
    `<${utf16BeHex(line.text)}> Tj`,
    "ET"
  ].join("\n");
}

function paginate(lines: TextLine[]) {
  const pages: TextLine[][] = [];
  let page: TextLine[] = [];
  let y = PAGE_HEIGHT - MARGIN_TOP;

  for (const line of lines) {
    const lineHeight = Math.ceil(line.size * 1.42 + (line.gapAfter ?? 0));
    if (y - lineHeight < MARGIN_BOTTOM && page.length > 0) {
      pages.push(page);
      page = [];
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
    page.push(line);
    y -= lineHeight;
  }

  if (page.length > 0) {
    pages.push(page);
  }
  return pages;
}

function buildPdf(lines: TextLine[]) {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add("PAGES_PLACEHOLDER");
  const pagesId = add("PAGES_PLACEHOLDER");
  const descriptorId = add(
    "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 /StemV 80 >>"
  );
  const cidFontId = add(
    `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${descriptorId} 0 R >>`
  );
  const fontId = add(
    `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] >>`
  );

  const pageIds: number[] = [];
  for (const [pageIndex, pageLines] of paginate(lines).entries()) {
    let y = PAGE_HEIGHT - MARGIN_TOP;
    const operations: string[] = [
      "q",
      "1 1 1 rg",
      `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`,
      "Q",
      "0.12 0.42 0.78 rg",
      `42 ${PAGE_HEIGHT - 34} 80 3 re f`
    ];

    for (const line of pageLines) {
      operations.push(streamText(line, MARGIN_X, y));
      y -= Math.ceil(line.size * 1.42 + (line.gapAfter ?? 0));
    }

    operations.push(streamText({ text: `Daily AI Insight Engine · ${pageIndex + 1}`, size: 8, color: [0.45, 0.49, 0.55] }, MARGIN_X, 28));

    const stream = operations.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks = ["%PDF-1.4\n%âãÏÓ\n"];
  const offsets: number[] = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join("")));
    chunks.push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""));
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "binary");
}

function main() {
  const report = readReport();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, buildPdf(buildLines(report)));
  console.log(`Generated ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();
