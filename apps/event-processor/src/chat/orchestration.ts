import type { Message, MessageContext, Thread } from "chat";

import {
  buildDefaultThreadMetadata,
  mergeThreadMetadata,
} from "../lib/thread-metadata";
import {
  buildProjectSetupPlan,
  prepareProjectCheckout,
} from "../sandbox/project-setup";
import {
  PLACEHOLDER_FAILURE_MESSAGE,
  PLACEHOLDER_READY_MESSAGE,
} from "./constants";
import { formatMessageBatchPrompt } from "./message-batch";
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
  projectPath: string,
  context?: MessageContext,
): string {
  const prompt = formatMessageBatchPrompt({
    context,
    currentMessage: message,
    projectPath,
  });

  return `${PLACEHOLDER_READY_MESSAGE}\n\nPrepared Flue prompt:\n\`\`\`text\n${prompt}\n\`\`\``;
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
    return mergeThreadMetadata(metadata, {
      setup: metadata.setup ?? { completed: false },
    });
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

    if (!metadata.setup.completed) {
      await prepareProjectCheckout(sandbox, buildProjectSetupPlan(metadata));

      metadata = mergeThreadMetadata(metadata, {
        lastError: null,
        sandbox,
        setup: {
          completed: true,
        },
        status: "complete",
      });
      await setThreadMetadata(thread, metadata);
    } else {
      metadata = mergeThreadMetadata(metadata, {
        lastError: null,
        sandbox,
        status: "complete",
      });
      await setThreadMetadata(thread, metadata);
    }

    await thread.post(
      formatPlaceholderMessage(message, env.DEMO_PROJECT_PATH, context),
    );
  } catch (error) {
    metadata = buildFailureMetadata(metadata, error);
    await setThreadMetadata(thread, metadata);
    await postFailure(thread, error);
    throw error;
  }
}
