import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultThreadMetadata,
  buildSandboxName,
  buildSandboxTags,
  mergeThreadMetadata,
  sanitizeSandboxNamePart,
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
  DEMO_PROJECT_PATH: "/vercel/sandbox/weather_starter",
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

test("buildSandboxName sanitizes adapter-scoped discord thread ids", () => {
  assert.equal(
    buildSandboxName("discord:1016971777764765746:1503650966908440638:ABC", env),
    "discord-discord-1016971777764765746-1503650966908440638-abc",
  );
});

test("sanitizeSandboxNamePart falls back when no safe characters remain", () => {
  assert.equal(sanitizeSandboxNamePart(":::==="), "sandbox");
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
    projectPath: "/vercel/sandbox/weather_starter",
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
    setup: {
      completed: false,
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
      setup: {
        completed: true,
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
      setup: {
        completed: true,
      },
      status: "complete",
    },
  );
});

test("mergeThreadMetadata preserves existing Flue sessions", () => {
  const metadata: ThreadMetadata = {
    ...buildDefaultThreadMetadata(thread, env),
    flue: {
      sessions: {
        existing: {
          createdAt: "2026-05-14T00:00:00.000Z",
          entries: [],
          leafId: null,
          metadata: {},
          updatedAt: "2026-05-14T00:00:00.000Z",
          version: 3,
        },
      },
    },
  };

  assert.deepEqual(
    mergeThreadMetadata(metadata, {
      flue: {
        sessions: {
          next: {
            createdAt: "2026-05-14T00:01:00.000Z",
            entries: [],
            leafId: null,
            metadata: {},
            updatedAt: "2026-05-14T00:01:00.000Z",
            version: 3,
          },
        },
      },
    }).flue?.sessions,
    {
      ...metadata.flue?.sessions,
      next: {
        createdAt: "2026-05-14T00:01:00.000Z",
        entries: [],
        leafId: null,
        metadata: {},
        updatedAt: "2026-05-14T00:01:00.000Z",
        version: 3,
      },
    },
  );
});
