import { NextResponse } from "next/server";
import { getLatestReport } from "@/lib/report-data";

export function GET() {
  return NextResponse.json(getLatestReport(), {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300"
    }
  });
}
