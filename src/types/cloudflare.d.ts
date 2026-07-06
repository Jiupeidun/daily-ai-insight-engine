import type { Ai, KVNamespace } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    AI?: Ai;
    AI_PROVIDER?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
    AI_MODEL?: string;
    AI_EXTRACTION_BATCH_SIZE?: string;
    AI_EXTRACTION_CONCURRENCY?: string;
    REPORT_ADMIN_TOKEN?: string;
    CLOUDFLARE_AI_MODEL?: string;
    REPORT_KV?: KVNamespace;
  }
}

export {};
