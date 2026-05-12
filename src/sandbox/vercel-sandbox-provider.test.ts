import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSandboxClientParams,
  createVercelSandboxProvider,
  resolveVercelSandboxCredentials,
} from "./vercel-sandbox-provider";
import type { Env } from "../types/env";
import type {
  SandboxClient,
  SandboxClientParams,
  VercelSandboxCredentials,
} from "../types/sandbox";
import type { ThreadSandboxMetadata } from "../types/thread-metadata";

const metadata: ThreadSandboxMetadata = {
  name: "discord-1234567890",
  tags: {
    app: "flue-discord-demo",
    discordChannelId: "1503650966908440638",
    discordThreadId: "1234567890",
    lifecycle: "demo",
    repo: "weather-starter",
  },
};

const credentials: VercelSandboxCredentials = {
  projectId: "prj_123",
  teamId: "team_123",
  token: "token_123",
};

test("buildSandboxClientParams uses thread metadata and persistent sandboxes", () => {
  assert.deepEqual(buildSandboxClientParams(metadata), {
    name: "discord-1234567890",
    persistent: true,
    projectId: undefined,
    tags: metadata.tags,
    teamId: undefined,
    token: undefined,
  });
});

test("createVercelSandboxProvider passes metadata and credentials to the client", async () => {
  let captured: SandboxClientParams | undefined;

  const client: SandboxClient = {
    async getOrCreate(params) {
      captured = params;
      return {
        name: params.name,
        persistent: params.persistent,
        tags: params.tags,
      };
    },
  };

  const provider = createVercelSandboxProvider({ client, credentials });
  const identity = await provider.getOrCreateSandbox(metadata);

  assert.deepEqual(captured, {
    name: "discord-1234567890",
    persistent: true,
    projectId: "prj_123",
    tags: metadata.tags,
    teamId: "team_123",
    token: "token_123",
  });

  assert.deepEqual(identity, {
    name: "discord-1234567890",
    persistent: true,
    tags: metadata.tags,
  });
});

test("createVercelSandboxProvider normalizes missing tags from metadata", async () => {
  const client: SandboxClient = {
    async getOrCreate(params) {
      return {
        name: params.name,
        persistent: params.persistent,
      };
    },
  };

  const provider = createVercelSandboxProvider({ client });
  const identity = await provider.getOrCreateSandbox(metadata);

  assert.deepEqual(identity, {
    name: "discord-1234567890",
    persistent: true,
    tags: metadata.tags,
  });
});

test("resolveVercelSandboxCredentials returns undefined when unset", () => {
  const env: Pick<Env, "VERCEL_PROJECT_ID" | "VERCEL_TEAM_ID" | "VERCEL_TOKEN"> =
    {};

  assert.equal(resolveVercelSandboxCredentials(env), undefined);
});

test("resolveVercelSandboxCredentials returns typed credentials when complete", () => {
  const env: Pick<Env, "VERCEL_PROJECT_ID" | "VERCEL_TEAM_ID" | "VERCEL_TOKEN"> =
    {
      VERCEL_PROJECT_ID: "prj_123",
      VERCEL_TEAM_ID: "team_123",
      VERCEL_TOKEN: "token_123",
    };

  assert.deepEqual(resolveVercelSandboxCredentials(env), credentials);
});

test("resolveVercelSandboxCredentials throws on partial configuration", () => {
  const env: Pick<Env, "VERCEL_PROJECT_ID" | "VERCEL_TEAM_ID" | "VERCEL_TOKEN"> =
    {
      VERCEL_PROJECT_ID: "prj_123",
      VERCEL_TOKEN: "token_123",
    };

  assert.throws(
    () => resolveVercelSandboxCredentials(env),
    /Missing: teamId/,
  );
});
