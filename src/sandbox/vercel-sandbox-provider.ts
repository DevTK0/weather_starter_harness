import { Sandbox } from "@vercel/sandbox";

import type { Env } from "../types/env";
import type {
  SandboxClient,
  SandboxClientParams,
  SandboxIdentity,
  SandboxProvider,
  VercelSandboxCredentials,
} from "../types/sandbox";
import type {
  ThreadSandboxMetadata,
  ThreadSandboxTags,
} from "../types/thread-metadata";

export function createVercelSandboxProvider({
  client = defaultSandboxClient,
  credentials,
}: {
  client?: SandboxClient;
  credentials?: VercelSandboxCredentials;
} = {}): SandboxProvider {
  return {
    async getOrCreateSandbox(
      metadata: ThreadSandboxMetadata,
    ): Promise<SandboxIdentity> {
      const sandbox = await client.getOrCreate(
        buildSandboxClientParams(metadata, credentials),
      );

      return {
        name: sandbox.name,
        persistent: sandbox.persistent,
        tags: normalizeSandboxTags(sandbox.tags, metadata.tags),
      };
    },
  };
}

export function buildSandboxClientParams(
  metadata: ThreadSandboxMetadata,
  credentials?: VercelSandboxCredentials,
): SandboxClientParams {
  return {
    name: metadata.name,
    persistent: true,
    projectId: credentials?.projectId,
    tags: metadata.tags,
    teamId: credentials?.teamId,
    token: credentials?.token,
  };
}

export function resolveVercelSandboxCredentials(
  env: Pick<Env, "VERCEL_PROJECT_ID" | "VERCEL_TEAM_ID" | "VERCEL_TOKEN">,
): VercelSandboxCredentials | undefined {
  const values = {
    projectId: env.VERCEL_PROJECT_ID,
    teamId: env.VERCEL_TEAM_ID,
    token: env.VERCEL_TOKEN,
  };

  const provided = Object.entries(values).filter(([, value]) => value);

  if (provided.length === 0) {
    return undefined;
  }

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Incomplete Vercel Sandbox credentials. Missing: ${missing.join(", ")}`,
    );
  }

  return {
    projectId: values.projectId!,
    teamId: values.teamId!,
    token: values.token!,
  };
}

function normalizeSandboxTags(
  tags: Record<string, string> | undefined,
  fallback: ThreadSandboxTags,
): ThreadSandboxTags {
  return {
    app: tags?.app ?? fallback.app,
    discordChannelId: tags?.discordChannelId ?? fallback.discordChannelId,
    discordThreadId: tags?.discordThreadId ?? fallback.discordThreadId,
    lifecycle: tags?.lifecycle ?? fallback.lifecycle,
    repo: tags?.repo ?? fallback.repo,
  };
}

const defaultSandboxClient: SandboxClient = {
  async getOrCreate(params) {
    return Sandbox.getOrCreate(params);
  },
};
