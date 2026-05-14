import type { Env } from "../types/env";
import type {
  ThreadIdentity,
  ThreadMetadata,
  ThreadMetadataUpdate,
  ThreadSandboxMetadata,
  ThreadSandboxTags,
} from "../types/thread-metadata";

export function buildSandboxName(
  threadId: string,
  env: Pick<Env, "SANDBOX_NAME_PREFIX">,
): string {
  return `${env.SANDBOX_NAME_PREFIX}${sanitizeSandboxNamePart(threadId)}`;
}

export function sanitizeSandboxNamePart(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "sandbox";
}

export function buildSandboxTags(
  thread: ThreadIdentity,
  env: Pick<
    Env,
    | "SANDBOX_TAG_APP"
    | "SANDBOX_TAG_LIFECYCLE"
    | "SANDBOX_TAG_REPO"
  >,
): ThreadSandboxTags {
  return {
    app: env.SANDBOX_TAG_APP,
    discordChannelId: thread.channelId,
    discordThreadId: thread.id,
    lifecycle: env.SANDBOX_TAG_LIFECYCLE,
    repo: env.SANDBOX_TAG_REPO,
  };
}

export function buildDefaultThreadMetadata(
  thread: ThreadIdentity,
  env: Pick<
    Env,
    | "DEMO_PROJECT_PATH"
    | "DEMO_REPO_URL"
    | "SANDBOX_NAME_PREFIX"
    | "SANDBOX_TAG_APP"
    | "SANDBOX_TAG_LIFECYCLE"
    | "SANDBOX_TAG_REPO"
  >,
): ThreadMetadata {
  return {
    flueSessionId: thread.id,
    lastError: null,
    projectPath: env.DEMO_PROJECT_PATH,
    repoUrl: env.DEMO_REPO_URL,
    sandbox: {
      name: buildSandboxName(thread.id, env),
      tags: buildSandboxTags(thread, env),
    },
    setup: {
      completed: false,
    },
    status: "pending",
  };
}

export function mergeThreadMetadata(
  metadata: ThreadMetadata,
  update: ThreadMetadataUpdate,
): ThreadMetadata {
  const sandbox = update.sandbox
    ? mergeSandboxMetadata(metadata.sandbox, update.sandbox)
    : metadata.sandbox;
  const setup = update.setup
    ? { ...metadata.setup, ...update.setup }
    : metadata.setup;

  return {
    ...metadata,
    ...update,
    sandbox,
    setup,
  };
}

function mergeSandboxMetadata(
  sandbox: ThreadSandboxMetadata,
  update: NonNullable<ThreadMetadataUpdate["sandbox"]>,
): ThreadSandboxMetadata {
  const tags = update.tags ? { ...sandbox.tags, ...update.tags } : sandbox.tags;

  return {
    ...sandbox,
    ...update,
    tags,
  };
}
