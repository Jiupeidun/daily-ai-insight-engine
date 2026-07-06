import type { Ai } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    AI?: Ai;
    AI_PROVIDER?: string;
    CLOUDFLARE_AI_MODEL?: string;
  }
}

export {};
