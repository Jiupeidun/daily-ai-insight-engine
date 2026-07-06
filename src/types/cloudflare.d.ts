import type { Ai } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    AI?: Ai;
    AI_PROVIDER?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
    AI_MODEL?: string;
    CLOUDFLARE_AI_MODEL?: string;
  }
}

export {};
