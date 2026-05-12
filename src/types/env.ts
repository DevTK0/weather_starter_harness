import type { ChatStateDO } from "chat-state-cloudflare-do";

export interface Env {
  AI_GATEWAY_API_KEY?: string;
  AI_GATEWAY_BASE_URL: string;
  CHAT_STATE: DurableObjectNamespace<ChatStateDO>;
  DEMO_PROJECT_PATH: string;
  DEMO_REPO_URL: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_DEMO_CHANNEL_ID: string;
  DISCORD_PUBLIC_KEY: string;
  FLUE_MODEL: string;
  PLACEHOLDER_PREVIEW_URL: string;
  SANDBOX_NAME_PREFIX: string;
  SANDBOX_TAG_APP: string;
  SANDBOX_TAG_LIFECYCLE: string;
  SANDBOX_TAG_REPO: string;
  VERCEL_PROJECT_ID?: string;
  VERCEL_TEAM_ID?: string;
  VERCEL_TOKEN?: string;
}
