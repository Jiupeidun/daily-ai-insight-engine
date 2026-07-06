// @ts-expect-error OpenNext generates this file before Wrangler deploy builds worker.ts.
import openNextWorker from "./.open-next/worker.js";
import { runReportRefresh } from "./src/lib/insight/refresh";

const worker = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return openNextWorker.fetch(request, env, ctx);
  },

  scheduled(event: ScheduledEvent, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      runReportRefresh(env as unknown as Record<string, unknown>, "cron")
        .then((result) => {
          console.log(
            JSON.stringify({
              event: "cron-report-refresh:complete",
              cron: event.cron,
              generatedAt: result.generatedAt,
              rawItems: result.rawItems,
              structuredItems: result.structuredItems,
              failedRecords: result.failedRecords.failedRecords.length,
              persisted: result.persisted,
              elapsedMs: result.elapsedMs
            })
          );
        })
        .catch((error) => {
          console.error(
            JSON.stringify({
              event: "cron-report-refresh:error",
              cron: event.cron,
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            })
          );
          throw error;
        })
    );
  }
};

export default worker;
