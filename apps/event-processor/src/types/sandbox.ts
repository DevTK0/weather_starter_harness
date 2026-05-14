import type { ThreadSandboxMetadata, ThreadSandboxTags } from "./thread-metadata";

export interface VercelSandboxCredentials {
  projectId: string;
  teamId: string;
  token: string;
}

export interface SandboxIdentity {
  name: string;
  persistent: boolean;
  tags: ThreadSandboxTags;
}

export interface SandboxCommandParams {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface SandboxCommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface SandboxWorkspace extends SandboxIdentity {
  runCommand(params: SandboxCommandParams): Promise<SandboxCommandResult>;
}

export interface SandboxProvider {
  getOrCreateSandbox(metadata: ThreadSandboxMetadata): Promise<SandboxWorkspace>;
}

export interface SandboxClientParams {
  name: string;
  persistent: boolean;
  projectId?: string;
  tags: ThreadSandboxTags;
  teamId?: string;
  token?: string;
}

export interface SandboxClientResult {
  name: string;
  persistent: boolean;
  runCommand(params: SandboxCommandParams): Promise<{
    exitCode: number;
    stdout(): Promise<string>;
    stderr(): Promise<string>;
  }>;
  tags?: Record<string, string>;
}

export interface SandboxClient {
  getOrCreate(params: SandboxClientParams): Promise<SandboxClientResult>;
}
