import { Sandbox } from "@vercel/sandbox";

import type { Env } from "../types/env";
import type {
  SandboxClient,
  SandboxClientParams,
  SandboxCommandParams,
  SandboxCommandResult,
  SandboxWorkspace,
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
    ): Promise<SandboxWorkspace> {
      let sandbox;

      try {
        sandbox = await client.getOrCreate(
          buildSandboxClientParams(metadata, credentials),
        );
      } catch (error) {
        throw new Error(
          `Vercel Sandbox getOrCreate failed for "${metadata.name}": ${formatSandboxError(error)}`,
        );
      }

      return {
        name: sandbox.name,
        persistent: sandbox.persistent,
        async runCommand(params: SandboxCommandParams): Promise<SandboxCommandResult> {
          const command = await sandbox.runCommand(params);

          return {
            exitCode: command.exitCode,
            stderr: await command.stderr(),
            stdout: await command.stdout(),
          };
        },
        tags: normalizeSandboxTags(sandbox.tags, metadata.tags),
      };
    },
  };
}

export function formatSandboxError(error: unknown): string {
  if (!isRecord(error)) {
    return String(error);
  }

  const parts: string[] = [];

  if (typeof error.message === "string" && error.message) {
    parts.push(error.message);
  }

  const status = getResponseStatus(error.response);
  if (status !== undefined) {
    parts.push(`HTTP ${status}`);
  }

  if (typeof error.text === "string" && error.text.trim()) {
    parts.push(error.text.trim());
  } else if (error.json !== undefined) {
    parts.push(JSON.stringify(error.json));
  }

  return parts.length > 0 ? parts.join(" - ") : String(error);
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

function getResponseStatus(response: unknown): number | undefined {
  if (!isRecord(response)) {
    return undefined;
  }

  return typeof response.status === "number" ? response.status : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
