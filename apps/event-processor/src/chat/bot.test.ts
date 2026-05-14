import assert from "node:assert/strict";
import test from "node:test";

import { handleEligibleMessage } from "./orchestration";
import type { FlueInvocationInput, FlueInvoker } from "./flue-invocation";
import type { Env } from "../types/env";
import type { SandboxCommandParams, SandboxProvider } from "../types/sandbox";
import type { ThreadMetadata } from "../types/thread-metadata";
import type { SessionData } from "@flue/runtime";

const env = {
  DEMO_PROJECT_PATH: "/vercel/sandbox/weather_starter",
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

function createFlueInvoker(text = "raw flue response") {
  const calls: FlueInvocationInput[] = [];
  const flueInvoker: FlueInvoker = async (input) => {
    calls.push(input);

    return {
      text,
    };
  };

  return {
    calls,
    flueInvoker,
  };
}

function createThread({
  channelId = "channel-123",
  state = null,
  subscribeError,
  providerError,
  setupError,
}: {
  channelId?: string;
  state?: ThreadMetadata | null;
  subscribeError?: Error;
  providerError?: Error;
  setupError?: Error;
} = {}) {
  let currentState = state;
  const stateWrites: ThreadMetadata[] = [];
  const posts: string[] = [];
  const setupCommands: SandboxCommandParams[] = [];
  let subscribeCalls = 0;
  let typingCalls = 0;
  let sandboxCalls = 0;

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
      sandboxCalls += 1;

      if (providerError) {
        throw providerError;
      }

      return {
        name: metadata.name,
        persistent: true,
        async runCommand(params) {
          setupCommands.push(params);

          if (setupError) {
            throw setupError;
          }

          return {
            exitCode: 0,
          };
        },
        tags: metadata.tags,
      };
    },
  };

  return {
    posts,
    sandboxCalls: () => sandboxCalls,
    sandboxProvider,
    setupCommands,
    stateWrites,
    subscribeCalls: () => subscribeCalls,
    thread,
    typingCalls: () => typingCalls,
  };
}

test("eligible mention prepares the sandbox, invokes Flue, and posts raw Flue text", async () => {
  const flue = createFlueInvoker("implemented the requested theme");
  const {
    posts,
    sandboxProvider,
    setupCommands,
    stateWrites,
    subscribeCalls,
    thread,
    typingCalls,
  } = createThread();

  await handleEligibleMessage(
    thread as never,
    createMessage("implement theming") as never,
    { totalSinceLastHandler: 1 } as never,
    env as Env,
    { flueInvoker: flue.flueInvoker, sandboxProvider },
    { subscribe: true },
  );

  assert.equal(subscribeCalls(), 1);
  assert.equal(typingCalls(), 1);
  assert.equal(stateWrites.length, 3);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[0].lastError, null);
  assert.equal(stateWrites[0].setup.completed, false);
  assert.equal(stateWrites[1].status, "running");
  assert.equal(stateWrites[1].setup.completed, true);
  assert.equal(stateWrites[1].sandbox.name, "discord-thread-123");
  assert.equal(stateWrites[2].status, "complete");
  assert.equal(stateWrites[2].setup.completed, true);
  assert.equal(setupCommands.length, 1);
  assert.deepEqual(setupCommands[0].env, {
    PROJECT_PATH: "/vercel/sandbox/weather_starter",
    REPO_URL: "https://github.com/AISG-AIAP/weather_starter.git",
  });
  assert.match(setupCommands[0].args?.join("\n") ?? "", /git clone --depth 1/);
  assert.equal(flue.calls.length, 1);
  assert.equal(flue.calls[0].metadata.flueSessionId, "thread-123");
  assert.equal(
    flue.calls[0].metadata.projectPath,
    "/vercel/sandbox/weather_starter",
  );
  assert.equal(flue.calls[0].sandbox.name, "discord-thread-123");
  assert.equal(flue.calls[0].currentMessage.text, "implement theming");
  assert.deepEqual(posts, ["implemented the requested theme"]);
});

test("subscribed follow-up reuses setup and sends queued batch context to Flue", async () => {
  const flue = createFlueInvoker("raw follow-up result");
  const existingState: ThreadMetadata = {
    flueSessionId: "thread-123",
    lastError: "old failure",
    projectPath: "existing_checkout",
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
    setup: {
      completed: true,
    },
    status: "failed",
  };

  const {
    posts,
    sandboxCalls,
    sandboxProvider,
    setupCommands,
    stateWrites,
    subscribeCalls,
    thread,
  } =
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
    { flueInvoker: flue.flueInvoker, sandboxProvider },
    { subscribe: false },
  );

  assert.equal(subscribeCalls(), 0);
  assert.equal(stateWrites[0].lastError, null);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[0].setup.completed, true);
  assert.equal(stateWrites[1].status, "running");
  assert.equal(stateWrites[1].setup.completed, true);
  assert.equal(stateWrites[2].status, "complete");
  assert.equal(stateWrites[2].setup.completed, true);
  assert.equal(sandboxCalls(), 1);
  assert.equal(setupCommands.length, 0);
  assert.equal(flue.calls.length, 1);
  assert.equal(flue.calls[0].metadata.flueSessionId, "thread-123");
  assert.equal(flue.calls[0].metadata.projectPath, "existing_checkout");
  assert.equal(flue.calls[0].context?.totalSinceLastHandler, 3);
  assert.deepEqual(posts, ["raw follow-up result"]);
});

test("final completion write preserves Flue session history saved by the invoker", async () => {
  const sessionData: SessionData = {
    createdAt: "2026-05-14T00:00:00.000Z",
    entries: [],
    leafId: null,
    metadata: {},
    updatedAt: "2026-05-14T00:01:00.000Z",
    version: 3,
  };
  const existingState: ThreadMetadata = {
    flueSessionId: "thread-123",
    lastError: null,
    projectPath: "/vercel/sandbox/weather_starter",
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
    setup: {
      completed: true,
    },
    status: "pending",
  };
  const { sandboxProvider, stateWrites, thread } = createThread({
    state: existingState,
  });
  const flueInvoker: FlueInvoker = async (input) => {
    await input.thread.setState(
      {
        ...input.metadata,
        flue: {
          sessions: {
            [input.metadata.flueSessionId]: sessionData,
          },
        },
      },
      { replace: true },
    );

    return { text: "done" };
  };

  await handleEligibleMessage(
    thread as never,
    createMessage("keep history") as never,
    undefined,
    env as Env,
    { flueInvoker, sandboxProvider },
    { subscribe: false },
  );

  assert.equal(stateWrites.at(-1)?.status, "complete");
  assert.deepEqual(stateWrites.at(-1)?.flue?.sessions, {
    "thread-123": sessionData,
  });
});

test("incomplete setup retries with the current configured project path", async () => {
  const flue = createFlueInvoker("retried setup on configured path");
  const existingState: ThreadMetadata = {
    flueSessionId: "thread-123",
    lastError:
      'Project setup failed for "/workspace/weather_starter": permission denied',
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
    setup: {
      completed: false,
    },
    status: "failed",
  };
  const { posts, sandboxProvider, setupCommands, stateWrites, thread } =
    createThread({ state: existingState });

  await handleEligibleMessage(
    thread as never,
    createMessage("retry after deploy") as never,
    undefined,
    env as Env,
    { flueInvoker: flue.flueInvoker, sandboxProvider },
    { subscribe: false },
  );

  assert.deepEqual(setupCommands[0].env, {
    PROJECT_PATH: "/vercel/sandbox/weather_starter",
    REPO_URL: "https://github.com/AISG-AIAP/weather_starter.git",
  });
  assert.equal(stateWrites[0].projectPath, "/vercel/sandbox/weather_starter");
  assert.equal(stateWrites.at(-1)?.setup.completed, true);
  assert.equal(
    flue.calls[0].metadata.projectPath,
    "/vercel/sandbox/weather_starter",
  );
  assert.deepEqual(posts, ["retried setup on configured path"]);
});

test("setup command failure leaves setup incomplete so the next message retries", async () => {
  const flue = createFlueInvoker();
  let failSetup = true;
  const { posts, sandboxProvider, stateWrites, setupCommands, thread } =
    createThread();

  sandboxProvider.getOrCreateSandbox = async (metadata) => ({
    name: metadata.name,
    persistent: true,
    async runCommand(params) {
      setupCommands.push(params);

      if (failSetup) {
        return {
          exitCode: 1,
          stderr: "clone failed",
        };
      }

      return {
        exitCode: 0,
      };
    },
    tags: metadata.tags,
  });

  await assert.rejects(
    handleEligibleMessage(
      thread as never,
      createMessage("implement theming") as never,
      undefined,
      env as Env,
      { flueInvoker: flue.flueInvoker, sandboxProvider },
      { subscribe: false },
    ),
    /Project setup failed.*clone failed/,
  );

  assert.equal(setupCommands.length, 1);
  assert.equal(stateWrites.length, 2);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[0].setup.completed, false);
  assert.equal(stateWrites[1].status, "failed");
  assert.equal(stateWrites[1].setup.completed, false);
  assert.match(stateWrites[1].lastError ?? "", /Project setup failed.*clone failed/);
  assert.deepEqual(posts, [
    'Plumbing check failed before implementation started.\n\nProject setup failed for "/vercel/sandbox/weather_starter": clone failed',
  ]);
  assert.equal(flue.calls.length, 0);

  failSetup = false;

  await handleEligibleMessage(
    thread as never,
    createMessage("retry setup") as never,
    undefined,
    env as Env,
    { flueInvoker: flue.flueInvoker, sandboxProvider },
    { subscribe: false },
  );

  assert.equal(setupCommands.length, 2);
  assert.equal(stateWrites.at(-1)?.status, "complete");
  assert.equal(stateWrites.at(-1)?.setup.completed, true);
  assert.equal(flue.calls.length, 1);
});

test("sandbox failure marks metadata failed, posts a short error, and rethrows", async () => {
  const flue = createFlueInvoker();
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
      { flueInvoker: flue.flueInvoker, sandboxProvider },
      { subscribe: false },
    ),
    /sandbox unavailable/,
  );

  assert.equal(stateWrites.length, 2);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[0].setup.completed, false);
  assert.equal(stateWrites[1].status, "failed");
  assert.equal(stateWrites[1].setup.completed, false);
  assert.equal(stateWrites[1].lastError, "sandbox unavailable");
  assert.deepEqual(posts, [
    "Plumbing check failed before implementation started.\n\nsandbox unavailable",
  ]);
  assert.equal(flue.calls.length, 0);
});

test("encoded Discord channel id matching the raw demo channel id is eligible", async () => {
  const flue = createFlueInvoker("encoded route result");
  const { posts, sandboxProvider, stateWrites, thread } = createThread({
    channelId: "discord:guild-456:channel-123",
  });

  await handleEligibleMessage(
    thread as never,
    createMessage("from gateway") as never,
    undefined,
    env as Env,
    { flueInvoker: flue.flueInvoker, sandboxProvider },
    { subscribe: false },
  );

  assert.equal(stateWrites.length, 3);
  assert.equal(stateWrites[0].status, "running");
  assert.equal(stateWrites[1].status, "running");
  assert.equal(stateWrites[1].setup.completed, true);
  assert.equal(stateWrites[2].status, "complete");
  assert.deepEqual(posts, ["encoded route result"]);
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
