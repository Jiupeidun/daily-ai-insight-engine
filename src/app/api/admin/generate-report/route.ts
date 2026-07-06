import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { runReportRefresh } from "@/lib/insight/refresh";

type AdminEnv = NodeJS.ProcessEnv & {
  REPORT_ADMIN_TOKEN?: string;
};

function getRuntimeEnv(): AdminEnv {
  try {
    return getCloudflareContext({ async: false }).env as AdminEnv;
  } catch {
    return process.env as AdminEnv;
  }
}

function isAuthorized(request: NextRequest, env: AdminEnv) {
  const token = env.REPORT_ADMIN_TOKEN;
  const authorization = request.headers.get("authorization");
  return Boolean(token && authorization === `Bearer ${token}`);
}

export async function POST(request: NextRequest) {
  const env = getRuntimeEnv();

  if (!isAuthorized(request, env)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReportRefresh(env, "admin");

  return NextResponse.json({
    generatedAt: result.generatedAt,
    provider: result.provider,
    model: result.model,
    persisted: result.persisted,
    rawItems: result.rawItems,
    structuredItems: result.structuredItems,
    failedRecordCount: result.failedRecords.failedRecords.length,
    structured: result.structured,
    failedRecords: result.failedRecords,
    report: result.report
  });
}
