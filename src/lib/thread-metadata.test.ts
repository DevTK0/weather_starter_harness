import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultThreadMetadata,
  buildSandboxName,
  buildSandboxTags,
  mergeThreadMetadata,
} from "./thread-metadata";
import type { Env } from "../types/env";
import type { ThreadIdentity, ThreadMetadata } from "../types/thread-metadata";

const env: Pick<
  Env,
  | "DEMO_PROJECT_PATH"
  | "DEMO_REPO_URL"
  | "SANDBOX_NAME_PREFIX"
  | "SANDBOX_TAG_APP"
  | "SANDBOX_TAG_LIFECYCLE"
  | "SANDBOX_TAG_REPO"
> = {
  DEMO_PROJECT_PATH: "/workspace/weather_starter",
  DEMO_REPO_URL: "https://github.com/AISG-AIAP/weather_starter.git",
  SANDBOX_NAME_PREFIX: "discord-",
  SANDBOX_TAG_APP: "flue-discord-demo",
  SANDBOX_TAG_LIFECYCLE: "demo",
  SANDBOX_TAG_REPO: "weather-starter",
};

const thread: ThreadIdentity = {
  channelId: "1503650966908440638",
  id: "1234567890",
};

test("buildSandboxName uses the deterministic discord prefix", () => {
  assert.equal(buildSandboxName(thread.id, env), "discord-1234567890");
});

test("buildSandboxTags includes deterministic env and thread values", () => {
  assert.deepEqual(buildSandboxTags(thread, env), {
    app: "flue-discord-demo",
    discordChannelId: "1503650966908440638",
    discordThreadId: "1234567890",
    lifecycle: "demo",
    repo: "weather-starter",
  });
});

test("buildDefaultThreadMetadata produces the plumbing-stage defaults", () => {
  assert.deepEqual(buildDefaultThreadMetadata(thread, env), {
    flueSessionId: "1234567890",
    lastError: null,
    projectPath: "/workspace/weather_starter",
    repoUrl: "https://github.com/AISG-AIAP/weather_starter.git",
    sandbox: {
      name: "discord-1234567890",
      tags: {
        app: "flue-discord-demo",
        discordChannelId: "1503650966908440638",
        discordThreadId: "1234567890",
        lifecycle: "demo",
        repo: "weather-starter",
      },
    },
    status: "pending",
  });
});

test("mergeThreadMetadata updates top-level fields without dropping defaults", () => {
  const metadata = buildDefaultThreadMetadata(thread, env);

  assert.deepEqual(
    mergeThreadMetadata(metadata, {
      lastError: "temporary failure",
      status: "failed",
    }),
    {
      ...metadata,
      lastError: "temporary failure",
      status: "failed",
    },
  );
});

test("mergeThreadMetadata deep-merges sandbox updates", () => {
  const metadata: ThreadMetadata = buildDefaultThreadMetadata(thread, env);

  assert.deepEqual(
    mergeThreadMetadata(metadata, {
      sandbox: {
        tags: {
          lifecycle: "smoke-test",
        },
      },
      status: "complete",
    }),
    {
      ...metadata,
      sandbox: {
        ...metadata.sandbox,
        tags: {
          ...metadata.sandbox.tags,
          lifecycle: "smoke-test",
        },
      },
      status: "complete",
    },
  );
});
