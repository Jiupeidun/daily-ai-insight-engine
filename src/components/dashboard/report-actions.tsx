"use client";

import { Download, GitBranch, Loader2 } from "lucide-react";
import { useState } from "react";

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
  pdfEndpoint,
  githubHref,
  pdfFileName
}: {
  pdfEndpoint: string;
  githubHref: string;
  pdfFileName: string;
}) {
  const [status, setStatus] = useState<"idle" | "generating" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function generatePdf() {
    if (status === "generating") {
      return;
    }

    setStatus("generating");
    setErrorMessage("");
    trackAction("generate_report_pdf_start", pdfFileName);

    try {
      const response = await fetch(pdfEndpoint, {
        method: "POST",
        headers: {
          accept: "application/pdf"
        }
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = (await response.json()) as {
            error?: string;
            detail?: string;
            requestId?: string;
            synthesisRationale?: string;
            synthesisStatus?: string;
          };
          const reason =
            payload.detail ?? payload.synthesisRationale ?? payload.error ?? `HTTP ${response.status}`;
          const request = payload.requestId ? ` requestId=${payload.requestId}` : "";
          throw new Error(`${reason}${request}`);
        }
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      trackAction("generate_report_pdf_success", pdfFileName);
      setStatus("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown PDF generation error";
      trackAction("generate_report_pdf_failed", pdfFileName);
      setErrorMessage(message.slice(0, 220));
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 5200);
    }
  }

  return (
    <div className="command-actions" aria-label="Report actions">
      <button
        type="button"
        className="control-link primary"
        onClick={generatePdf}
        disabled={status === "generating"}
      >
        {status === "generating" ? (
          <Loader2 aria-hidden="true" className="spin-icon" size={16} />
        ) : (
          <Download aria-hidden="true" size={16} />
        )}
        <span className="lang-zh">
          {status === "generating" ? "生成中" : status === "failed" ? "生成失败" : "生成日报 PDF"}
        </span>
        <span className="lang-en">
          {status === "generating" ? "Generating" : status === "failed" ? "Failed" : "Generate PDF"}
        </span>
      </button>
      {errorMessage ? <span className="action-error" title={errorMessage}>{errorMessage}</span> : null}
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
