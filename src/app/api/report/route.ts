import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { getLatestReport } from "@/lib/report-data";

function getRuntimeEnv() {
  try {
    return getCloudflareContext({ async: false }).env;
  } catch {
    return process.env;
  }
}

export async function GET() {
  return NextResponse.json(await getLatestReport(getRuntimeEnv() as Record<string, unknown>), {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300"
    }
  });
}
