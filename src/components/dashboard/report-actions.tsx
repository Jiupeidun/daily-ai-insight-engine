"use client";

import { Download, FileJson2, GitBranch } from "lucide-react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function trackAction(action: string, label: string) {
  window.gtag?.("event", action, {
    event_category: "report",
    event_label: label
  });
}

export function ReportActions({
  pdfHref,
  jsonHref,
  githubHref,
  pdfFileName
}: {
  pdfHref: string;
  jsonHref: string;
  githubHref: string;
  pdfFileName: string;
}) {
  return (
    <div className="command-actions" aria-label="Report actions">
      <a
        className="control-link primary"
        href={pdfHref}
        download={pdfFileName}
        onClick={() => trackAction("download_report_pdf", pdfFileName)}
      >
        <Download aria-hidden="true" size={16} />
        <span className="lang-zh">下载日报 PDF</span>
        <span className="lang-en">Download PDF</span>
      </a>
      <a
        className="control-link"
        href={jsonHref}
        onClick={() => trackAction("open_report_json", jsonHref)}
      >
        <FileJson2 aria-hidden="true" size={16} />
        <span>JSON</span>
      </a>
      <a
        className="control-link"
        href={githubHref}
        onClick={() => trackAction("open_github", githubHref)}
      >
        <GitBranch aria-hidden="true" size={16} />
        <span>GitHub</span>
      </a>
    </div>
  );
}
