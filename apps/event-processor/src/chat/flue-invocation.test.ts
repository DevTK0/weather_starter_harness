import assert from "node:assert/strict";
import test from "node:test";

import { buildDefaultThreadMetadata } from "../lib/thread-metadata";
import {
  createThreadSessionStore,
  normalizeProviderBaseUrl,
} from "./flue-invocation";
import type { Env } from "../types/env";
import type { ThreadMetadata } from "../types/thread-metadata";
import type { SessionData } from "@flue/runtime";

const env: Pick<
  Env,
  | "DEMO_PROJECT_PATH"
  | "DEMO_REPO_URL"
  | "SANDBOX_NAME_PREFIX"
  | "SANDBOX_TAG_APP"
  | "SANDBOX_TAG_LIFECYCLE"
  | "SANDBOX_TAG_REPO"
> = {
  DEMO_PROJECT_PATH: "/vercel/sandbox/weather_starter",
  DEMO_REPO_URL: "https://github.com/AISG-AIAP/weather_starter.git",
  SANDBOX_NAME_PREFIX: "discord-",
  SANDBOX_TAG_APP: "flue-discord-demo",
  SANDBOX_TAG_LIFECYCLE: "demo",
  SANDBOX_TAG_REPO: "weather-starter",
};

function createSessionData(updatedAt: string): SessionData {
  return {
    createdAt: "2026-05-14T00:00:00.000Z",
    entries: [],
    leafId: null,
    metadata: {},
    updatedAt,
    version: 3,
  };
}

test("thread session store persists Flue session data in thread metadata", async () => {
  let state: ThreadMetadata | null = buildDefaultThreadMetadata(
    {
      channelId: "channel-123",
      id: "thread-123",
    },
    env,
  );
  const writes: ThreadMetadata[] = [];
  const thread = {
    get state() {
      return Promise.resolve(state);
    },
    async setState(metadata: ThreadMetadata) {
      state = metadata;
      writes.push(metadata);
    },
  };
  const store = createThreadSessionStore(thread as never, state);
  const sessionData = createSessionData("2026-05-14T00:01:00.000Z");

  assert.equal(await store.load("agent-session"), null);

  await store.save("agent-session", sessionData);

  assert.deepEqual(await store.load("agent-session"), sessionData);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, "pending");
  assert.deepEqual(writes[0].flue?.sessions, {
    "agent-session": sessionData,
  });

  await store.delete("agent-session");

  assert.equal(await store.load("agent-session"), null);
  assert.deepEqual(writes[1].flue?.sessions, {});
});

test("normalizes Anthropic gateway base URL before provider configuration", () => {
  assert.equal(
    normalizeProviderBaseUrl("anthropic", "https://ai-gateway.vercel.sh/v1"),
    "https://ai-gateway.vercel.sh",
  );
  assert.equal(
    normalizeProviderBaseUrl("anthropic", "https://ai-gateway.vercel.sh/v1/"),
    "https://ai-gateway.vercel.sh",
  );
});

test("does not rewrite non-Anthropic provider base URLs", () => {
  assert.equal(
    normalizeProviderBaseUrl("openai", "https://api.openai.com/v1"),
    "https://api.openai.com/v1",
  );
});
