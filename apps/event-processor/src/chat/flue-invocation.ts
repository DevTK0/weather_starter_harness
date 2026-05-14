import { configureProvider } from "@flue/runtime/app";
import {
  createFlueContext,
  resolveModel,
} from "@flue/runtime/internal";
import { createSandboxSessionEnv, type SandboxApi } from "@flue/runtime";

import { formatMessageBatchPrompt } from "./message-batch";
import { mergeThreadMetadata } from "../lib/thread-metadata";
import type { Env } from "../types/env";
import type { SandboxWorkspace } from "../types/sandbox";
import type { ThreadMetadata } from "../types/thread-metadata";
import type { Message, MessageContext, Thread } from "chat";
import type {
  AgentConfig,
  SessionData,
  SessionEnv,
  SessionStore,
} from "@flue/runtime";

export interface FlueInvocationInput {
  context?: MessageContext;
  currentMessage: Message;
  env: Env;
  metadata: ThreadMetadata;
  sandbox: SandboxWorkspace;
  thread: Thread<ThreadMetadata>;
}

export interface FlueInvocationResult {
  text: string;
}

export type FlueInvoker = (
  input: FlueInvocationInput,
) => Promise<FlueInvocationResult>;

let configuredProviderKey: string | undefined;

export async function invokeFlueSession({
  context,
  currentMessage,
  env,
  metadata,
  sandbox,
  thread,
}: FlueInvocationInput): Promise<FlueInvocationResult> {
  configureModelProvider(env);

  const prompt = formatMessageBatchPrompt({
    context,
    currentMessage,
    projectPath: metadata.projectPath,
  });
  const cwd = metadata.projectPath;
  const sessionStore = createThreadSessionStore(thread, metadata);
  const harness = await createFlueContext({
    agentConfig: createAgentConfig(),
    createDefaultEnv: () => createSessionEnv(sandbox, cwd),
    defaultStore: sessionStore,
    env: env as unknown as Record<string, unknown>,
    id: metadata.flueSessionId,
    payload: { discordThreadId: metadata.sandbox.tags.discordThreadId },
    runId: `discord:${metadata.flueSessionId}:${Date.now()}`,
  }).init({
    cwd,
    model: env.FLUE_MODEL,
    name: "event-processor",
    persist: sessionStore,
    sandbox: {
      createSessionEnv: () => createSessionEnv(sandbox, cwd),
    },
  });

  const session = await harness.session(metadata.flueSessionId);
  const result = await session.prompt(prompt);

  return {
    text: result.text,
  };
}

export function createThreadSessionStore(
  thread: Pick<Thread<ThreadMetadata>, "state" | "setState">,
  fallbackMetadata: ThreadMetadata,
): SessionStore {
  async function loadMetadata(): Promise<ThreadMetadata> {
    return (await thread.state) ?? fallbackMetadata;
  }

  return {
    async delete(id) {
      const metadata = await loadMetadata();
      const sessions = { ...(metadata.flue?.sessions ?? {}) };
      delete sessions[id];

      await thread.setState(
        { ...metadata, flue: { sessions } },
        { replace: true },
      );
    },
    async load(id) {
      const metadata = await loadMetadata();
      return metadata.flue?.sessions[id] ?? null;
    },
    async save(id, data: SessionData) {
      const metadata = await loadMetadata();

      await thread.setState(
        mergeThreadMetadata(metadata, {
          flue: {
            sessions: {
              ...(metadata.flue?.sessions ?? {}),
              [id]: data,
            },
          },
        }),
        { replace: true },
      );
    },
  };
}

function configureModelProvider(
  env: Pick<Env, "AI_GATEWAY_API_KEY" | "AI_GATEWAY_BASE_URL" | "FLUE_MODEL">,
): void {
  const provider = env.FLUE_MODEL.split("/")[0];
  const baseUrl = normalizeProviderBaseUrl(provider, env.AI_GATEWAY_BASE_URL);
  const providerKey = [
    provider,
    baseUrl,
    env.AI_GATEWAY_API_KEY ?? "",
  ].join(":");

  if (!provider || configuredProviderKey === providerKey) {
    return;
  }

  configureProvider(provider, {
    apiKey: env.AI_GATEWAY_API_KEY,
    baseUrl,
  });
  configuredProviderKey = providerKey;
}

export function normalizeProviderBaseUrl(provider: string, baseUrl: string): string {
  if (provider !== "anthropic") {
    return baseUrl;
  }

  return baseUrl.replace(/\/v1\/?$/, "");
}

function createAgentConfig(): AgentConfig {
  return {
    model: undefined,
    resolveModel,
    roles: {},
    skills: {},
    systemPrompt: "",
  };
}

async function createSessionEnv(
  sandbox: SandboxWorkspace,
  cwd: string,
): Promise<SessionEnv> {
  return createSandboxSessionEnv(createSandboxApi(sandbox), cwd);
}

function createSandboxApi(sandbox: SandboxWorkspace): SandboxApi {
  const readFileBuffer = async (path: string): Promise<Uint8Array> => {
    const result = await expectCommandSuccess(
      sandbox,
      {
        args: ["-lc", 'base64 < "$FLUE_PATH"'],
        cmd: "sh",
        env: { FLUE_PATH: path },
      },
      `readFile failed for ${path}`,
    );

    return base64ToBytes(result.stdout ?? "");
  };

  return {
    async exec(command, options) {
      const result = await sandbox.runCommand({
        args: ["-lc", command],
        cmd: "sh",
        cwd: options?.cwd,
        env: options?.env,
      });

      return {
        exitCode: result.exitCode,
        stderr: result.stderr ?? "",
        stdout: result.stdout ?? "",
      };
    },
    async exists(path) {
      const result = await sandbox.runCommand({
        args: ["-lc", 'test -e "$FLUE_PATH"'],
        cmd: "sh",
        env: { FLUE_PATH: path },
      });

      return result.exitCode === 0;
    },
    async mkdir(path, options) {
      await expectCommandSuccess(
        sandbox,
        {
          args: ["-lc", options?.recursive ? 'mkdir -p "$FLUE_PATH"' : 'mkdir "$FLUE_PATH"'],
          cmd: "sh",
          env: { FLUE_PATH: path },
        },
        `mkdir failed for ${path}`,
      );
    },
    async readFile(path) {
      const bytes = await readFileBuffer(path);
      return new TextDecoder().decode(bytes);
    },
    readFileBuffer,
    async readdir(path) {
      const result = await expectCommandSuccess(
        sandbox,
        {
          args: ["-lc", 'find "$FLUE_PATH" -maxdepth 1 -mindepth 1 -printf "%f\\0"'],
          cmd: "sh",
          env: { FLUE_PATH: path },
        },
        `readdir failed for ${path}`,
      );

      return (result.stdout ?? "").split("\0").filter(Boolean);
    },
    async rm(path, options) {
      const flags = [options?.recursive ? "-r" : "", options?.force ? "-f" : ""]
        .filter(Boolean)
        .join("");
      await expectCommandSuccess(
        sandbox,
        {
          args: ["-lc", `rm ${flags} "$FLUE_PATH"`],
          cmd: "sh",
          env: { FLUE_PATH: path },
        },
        `rm failed for ${path}`,
      );
    },
    async stat(path) {
      const result = await expectCommandSuccess(
        sandbox,
        {
          args: ["-lc", 'stat -c "%F\t%s\t%Y" "$FLUE_PATH"'],
          cmd: "sh",
          env: { FLUE_PATH: path },
        },
        `stat failed for ${path}`,
      );
      const [kind = "", size = "0", mtime = "0"] = (result.stdout ?? "")
        .trim()
        .split("\t");

      return {
        isDirectory: kind === "directory",
        isFile: kind === "regular file",
        isSymbolicLink: kind === "symbolic link",
        mtime: new Date(Number(mtime) * 1000),
        size: Number(size),
      };
    },
    async writeFile(path, content) {
      const data =
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content;

      await expectCommandSuccess(
        sandbox,
        {
          args: ["-lc", 'printf "%s" "$FLUE_WRITE_B64" | base64 -d > "$FLUE_PATH"'],
          cmd: "sh",
          env: {
            FLUE_PATH: path,
            FLUE_WRITE_B64: bytesToBase64(data),
          },
        },
        `writeFile failed for ${path}`,
      );
    },
  };
}

async function expectCommandSuccess(
  sandbox: SandboxWorkspace,
  params: Parameters<SandboxWorkspace["runCommand"]>[0],
  message: string,
): Promise<Awaited<ReturnType<SandboxWorkspace["runCommand"]>>> {
  const result = await sandbox.runCommand(params);

  if (result.exitCode !== 0) {
    const detail = [result.stderr, result.stdout]
      .filter((value) => value && value.trim())
      .join("\n")
      .trim();
    throw new Error(detail ? `${message}: ${detail}` : message);
  }

  return result;
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}
