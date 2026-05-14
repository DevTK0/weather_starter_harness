import { createDiscordAdapter } from "@chat-adapter/discord";
import { Chat } from "chat";
import { createCloudflareState } from "chat-state-cloudflare-do";

import {
  createVercelSandboxProvider,
  resolveVercelSandboxCredentials,
} from "../sandbox/vercel-sandbox-provider";
import { CHAT_CONCURRENCY } from "./constants";
import {
  handleEligibleMessage,
  type BotDependencies,
  type BotThreadState,
} from "./orchestration";
import type { Env } from "../types/env";

export function createBot(
  env: Env,
  dependencies: Partial<BotDependencies> = {},
) {
  const resolvedDependencies: BotDependencies = {
    sandboxProvider:
      dependencies.sandboxProvider ??
      createVercelSandboxProvider({
        credentials: resolveVercelSandboxCredentials(env),
      }),
  };

  const bot = new Chat({
    userName: "flue-discord-demo",
    adapters: {
      discord: createDiscordAdapter({
        applicationId: env.DISCORD_APPLICATION_ID,
        botToken: env.DISCORD_BOT_TOKEN,
        publicKey: env.DISCORD_PUBLIC_KEY,
        userName: "flue-discord-demo",
      }),
    },
    concurrency: CHAT_CONCURRENCY,
    logger: "info",
    state: createCloudflareState({
      namespace: env.CHAT_STATE,
      shardKey: (threadId) => threadId.split(":").slice(0, 2).join(":"),
    }),
  });

  bot.onNewMention(async (thread, message, context) => {
    await handleEligibleMessage(
      thread,
      message,
      context,
      env,
      resolvedDependencies,
      { subscribe: true },
    );
  });

  bot.onSubscribedMessage(async (thread, message, context) => {
    await handleEligibleMessage(
      thread,
      message,
      context,
      env,
      resolvedDependencies,
      { subscribe: false },
    );
  });

  return bot;
}
