import type { Message, MessageContext, Thread } from "chat";

import {
  buildDefaultThreadMetadata,
  mergeThreadMetadata,
} from "../lib/thread-metadata";
import {
  PLACEHOLDER_FAILURE_MESSAGE,
  PLACEHOLDER_READY_MESSAGE,
} from "./constants";
import type { Env } from "../types/env";
import type { SandboxProvider } from "../types/sandbox";
import type { ThreadMetadata } from "../types/thread-metadata";

export type BotThreadState = ThreadMetadata;

export interface BotDependencies {
  sandboxProvider: SandboxProvider;
}

function normalizeDiscordChannelId(channelId: string): string {
  if (!channelId.startsWith("discord:")) {
    return channelId;
  }

  const encodedChannelId = channelId.split("/")[0]?.split(":").at(-1);
  return encodedChannelId ?? channelId;
}

export function isDemoChannel(thread: Thread<BotThreadState>, env: Env): boolean {
  return (
    normalizeDiscordChannelId(thread.channelId) === env.DISCORD_DEMO_CHANNEL_ID
  );
}

export function formatPlaceholderMessage(
  message: Message,
  context?: MessageContext,
): string {
  const queuedCount = context?.totalSinceLastHandler ?? 1;

  if (queuedCount > 1) {
    return `${PLACEHOLDER_READY_MESSAGE}\n\nLatest request: ${message.text}\nQueued messages in this burst: ${queuedCount}`;
  }

  return `${PLACEHOLDER_READY_MESSAGE}\n\nLatest request: ${message.text}`;
}

export async function postFailure(
  thread: Thread<BotThreadState>,
  error: unknown,
): Promise<void> {
  const detail = error instanceof Error ? error.message : String(error);
  await thread.post(`${PLACEHOLDER_FAILURE_MESSAGE}\n\n${detail}`);
}

export async function getThreadMetadata(
  thread: Thread<BotThreadState>,
  env: Env,
): Promise<ThreadMetadata> {
  const metadata = await thread.state;

  if (metadata) {
    return metadata;
  }

  return buildDefaultThreadMetadata(
    {
      channelId: thread.channelId,
      id: thread.id,
    },
    env,
  );
}

export async function setThreadMetadata(
  thread: Thread<BotThreadState>,
  metadata: ThreadMetadata,
): Promise<void> {
  await thread.setState(metadata, { replace: true });
}

export function buildFailureMetadata(
  metadata: ThreadMetadata,
  error: unknown,
): ThreadMetadata {
  const detail = error instanceof Error ? error.message : String(error);

  return mergeThreadMetadata(metadata, {
    lastError: detail,
    status: "failed",
  });
}

export async function handleEligibleMessage(
  thread: Thread<BotThreadState>,
  message: Message,
  context: MessageContext | undefined,
  env: Env,
  dependencies: BotDependencies,
  { subscribe }: { subscribe: boolean },
): Promise<void> {
  if (message.author.isBot || !isDemoChannel(thread, env)) {
    return;
  }

  let metadata = await getThreadMetadata(thread, env);

  try {
    if (subscribe) {
      await thread.subscribe();
    }

    await thread.startTyping();

    metadata = mergeThreadMetadata(metadata, {
      lastError: null,
      status: "running",
    });
    await setThreadMetadata(thread, metadata);

    const sandbox = await dependencies.sandboxProvider.getOrCreateSandbox(
      metadata.sandbox,
    );

    metadata = mergeThreadMetadata(metadata, {
      lastError: null,
      sandbox,
      status: "complete",
    });
    await setThreadMetadata(thread, metadata);

    await thread.post(formatPlaceholderMessage(message, context));
  } catch (error) {
    metadata = buildFailureMetadata(metadata, error);
    await setThreadMetadata(thread, metadata);
    await postFailure(thread, error);
    throw error;
  }
}
