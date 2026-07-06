import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import rawNews from "../../../../../data/raw/news-items.json";
import { optionsFromEnv } from "@/lib/insight/extract";
import { extractArticles } from "@/lib/insight/extract";
import { generateDailyReportWithAiSupport } from "@/lib/insight/report";
import { RawNewsItemSchema } from "@/lib/insight/schema";

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

  const rawItems = RawNewsItemSchema.array().parse((rawNews as { items: unknown }).items);
  const options = optionsFromEnv(env);
  const failedRecords: unknown[] = [];
  const articles = await extractArticles(rawItems, {
    ...options,
    onFailure: (failure) => failedRecords.push(failure)
  });
  const report = await generateDailyReportWithAiSupport(articles, rawItems.length, options);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    provider: options.provider,
    structured: {
      generatedAt: new Date().toISOString(),
      articles
    },
    failedRecords,
    report
  });
}
