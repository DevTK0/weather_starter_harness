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

function createThread({
  state = null,
  subscribeError,
  providerError,
}: {
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
    channelId: "channel-123",
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
    "Plumbing check received. The Discord chat layer is wired up, but implementation is not enabled yet.\n\nLatest request: implement theming",
  ]);
});

test("subscribed follow-up reuses existing metadata and reports queue burst count", async () => {
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
    { totalSinceLastHandler: 3 } as never,
    env as Env,
    { sandboxProvider },
    { subscribe: false },
  );

  assert.equal(subscribeCalls(), 0);
  assert.equal(stateWrites[0].lastError, null);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[1].status, "complete");
  assert.deepEqual(posts, [
    "Plumbing check received. The Discord chat layer is wired up, but implementation is not enabled yet.\n\nLatest request: actually make it green\nQueued messages in this burst: 3",
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
