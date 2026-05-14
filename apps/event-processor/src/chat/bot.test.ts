import assert from "node:assert/strict";
import test from "node:test";

import { handleEligibleMessage } from "./orchestration";
import type { Env } from "../types/env";
import type { SandboxProvider } from "../types/sandbox";
import type { ThreadMetadata } from "../types/thread-metadata";

const env = {
  DEMO_PROJECT_PATH: "/workspace/weather_starter",
  DEMO_REPO_URL: "https://github.com/AISG-AIAP/weather_starter.git",
  DISCORD_DEMO_CHANNEL_ID: "channel-123",
  PLACEHOLDER_PREVIEW_URL: "https://example.com/preview",
  SANDBOX_NAME_PREFIX: "discord-",
  SANDBOX_TAG_APP: "flue-discord-demo",
  SANDBOX_TAG_LIFECYCLE: "demo",
  SANDBOX_TAG_REPO: "weather-starter",
} as Pick<
  Env,
  | "DEMO_PROJECT_PATH"
  | "DEMO_REPO_URL"
  | "DISCORD_DEMO_CHANNEL_ID"
  | "PLACEHOLDER_PREVIEW_URL"
  | "SANDBOX_NAME_PREFIX"
  | "SANDBOX_TAG_APP"
  | "SANDBOX_TAG_LIFECYCLE"
  | "SANDBOX_TAG_REPO"
>;

function createMessage(text: string, isBot = false) {
  return {
    author: {
      isBot,
    },
    text,
  };
}

function expectedPlaceholder(prompt: string): string {
  return [
    "Plumbing check received. The Discord chat layer is wired up, but implementation is not enabled yet.",
    `Prepared Flue prompt:\n\`\`\`text\n${prompt}\n\`\`\``,
  ].join("\n\n");
}

function createThread({
  channelId = "channel-123",
  state = null,
  subscribeError,
  providerError,
}: {
  channelId?: string;
  state?: ThreadMetadata | null;
  subscribeError?: Error;
  providerError?: Error;
} = {}) {
  let currentState = state;
  const stateWrites: ThreadMetadata[] = [];
  const posts: string[] = [];
  let subscribeCalls = 0;
  let typingCalls = 0;

  const thread = {
    channelId,
    id: "thread-123",
    get state() {
      return Promise.resolve(currentState);
    },
    async post(message: string) {
      posts.push(message);
    },
    async setState(metadata: ThreadMetadata) {
      currentState = metadata;
      stateWrites.push(metadata);
    },
    async startTyping() {
      typingCalls += 1;
    },
    async subscribe() {
      subscribeCalls += 1;

      if (subscribeError) {
        throw subscribeError;
      }
    },
  };

  const sandboxProvider: SandboxProvider = {
    async getOrCreateSandbox(metadata) {
      if (providerError) {
        throw providerError;
      }

      return {
        name: metadata.name,
        persistent: true,
        tags: metadata.tags,
      };
    },
  };

  return {
    posts,
    sandboxProvider,
    stateWrites,
    subscribeCalls: () => subscribeCalls,
    thread,
    typingCalls: () => typingCalls,
  };
}

test("eligible mention creates metadata, marks running and complete, and posts placeholder success", async () => {
  const { posts, sandboxProvider, stateWrites, subscribeCalls, thread, typingCalls } =
    createThread();

  await handleEligibleMessage(
    thread as never,
    createMessage("implement theming") as never,
    { totalSinceLastHandler: 1 } as never,
    env as Env,
    { sandboxProvider },
    { subscribe: true },
  );

  assert.equal(subscribeCalls(), 1);
  assert.equal(typingCalls(), 1);
  assert.equal(stateWrites.length, 2);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[0].lastError, null);
  assert.equal(stateWrites[1].status, "complete");
  assert.equal(stateWrites[1].sandbox.name, "discord-thread-123");
  assert.deepEqual(posts, [
    expectedPlaceholder(
      [
        "You are the Implementation Agent for the Discord Implementation Harness.",
        "Work in the configured weather_starter project path: /workspace/weather_starter",
        "Use this latest Discord message as the instruction for this Work Cycle:",
        "implement theming",
      ].join("\n\n"),
    ),
  ]);
});

test("subscribed follow-up reuses existing metadata and posts queued batch prompt", async () => {
  const existingState: ThreadMetadata = {
    flueSessionId: "thread-123",
    lastError: "old failure",
    projectPath: "/workspace/weather_starter",
    repoUrl: "https://github.com/AISG-AIAP/weather_starter.git",
    sandbox: {
      name: "discord-thread-123",
      tags: {
        app: "flue-discord-demo",
        discordChannelId: "channel-123",
        discordThreadId: "thread-123",
        lifecycle: "demo",
        repo: "weather-starter",
      },
    },
    status: "failed",
  };

  const { posts, sandboxProvider, stateWrites, subscribeCalls, thread } =
    createThread({ state: existingState });

  await handleEligibleMessage(
    thread as never,
    createMessage("actually make it green") as never,
    {
      skipped: [
        createMessage("make it blue"),
        createMessage("wait, make it accessible"),
      ],
      totalSinceLastHandler: 3,
    } as never,
    env as Env,
    { sandboxProvider },
    { subscribe: false },
  );

  assert.equal(subscribeCalls(), 0);
  assert.equal(stateWrites[0].lastError, null);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[1].status, "complete");
  assert.deepEqual(posts, [
    expectedPlaceholder(
      [
        "You are the Implementation Agent for the Discord Implementation Harness.",
        "Work in the configured weather_starter project path: /workspace/weather_starter",
        "Use this chronological Message Batch as the latest instruction sequence for this Work Cycle.",
        "Later messages can refine or replace earlier messages.",
        "1. make it blue\n2. wait, make it accessible\n3. actually make it green",
      ].join("\n\n"),
    ),
  ]);
});

test("sandbox failure marks metadata failed, posts a short error, and rethrows", async () => {
  const providerError = new Error("sandbox unavailable");
  const { posts, sandboxProvider, stateWrites, thread } = createThread({
    providerError,
  });

  await assert.rejects(
    handleEligibleMessage(
      thread as never,
      createMessage("implement theming") as never,
      undefined,
      env as Env,
      { sandboxProvider },
      { subscribe: false },
    ),
    /sandbox unavailable/,
  );

  assert.equal(stateWrites.length, 2);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[1].status, "failed");
  assert.equal(stateWrites[1].lastError, "sandbox unavailable");
  assert.deepEqual(posts, [
    "Plumbing check failed before implementation started.\n\nsandbox unavailable",
  ]);
});

test("encoded Discord channel id matching the raw demo channel id is eligible", async () => {
  const { posts, sandboxProvider, stateWrites, thread } = createThread({
    channelId: "discord:guild-456:channel-123",
  });

  await handleEligibleMessage(
    thread as never,
    createMessage("from gateway") as never,
    undefined,
    env as Env,
    { sandboxProvider },
    { subscribe: false },
  );

  assert.equal(stateWrites.length, 2);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[1].status, "complete");
  assert.deepEqual(posts, [
    expectedPlaceholder(
      [
        "You are the Implementation Agent for the Discord Implementation Harness.",
        "Work in the configured weather_starter project path: /workspace/weather_starter",
        "Use this latest Discord message as the instruction for this Work Cycle:",
        "from gateway",
      ].join("\n\n"),
    ),
  ]);
});

test("encoded Discord channel id with different raw channel is ignored", async () => {
  const { posts, sandboxProvider, stateWrites, subscribeCalls, thread, typingCalls } =
    createThread({
      channelId: "discord:guild-456:different-channel",
    });

  await handleEligibleMessage(
    thread as never,
    createMessage("wrong encoded channel") as never,
    undefined,
    env as Env,
    { sandboxProvider },
    { subscribe: true },
  );

  assert.equal(subscribeCalls(), 0);
  assert.equal(typingCalls(), 0);
  assert.equal(stateWrites.length, 0);
  assert.deepEqual(posts, []);
});

test("bot messages and non-demo channels are ignored", async () => {
  const { posts, sandboxProvider, stateWrites, subscribeCalls, thread, typingCalls } =
    createThread();

  await handleEligibleMessage(
    thread as never,
    createMessage("ignore me", true) as never,
    undefined,
    env as Env,
    { sandboxProvider },
    { subscribe: true },
  );

  const offChannelThread = {
    ...thread,
    channelId: "different-channel",
  };

  await handleEligibleMessage(
    offChannelThread as never,
    createMessage("wrong place") as never,
    undefined,
    env as Env,
    { sandboxProvider },
    { subscribe: true },
  );

  assert.equal(subscribeCalls(), 0);
  assert.equal(typingCalls(), 0);
  assert.equal(stateWrites.length, 0);
  assert.deepEqual(posts, []);
});
