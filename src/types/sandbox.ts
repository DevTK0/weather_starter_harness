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

export interface SandboxProvider {
  getOrCreateSandbox(metadata: ThreadSandboxMetadata): Promise<SandboxIdentity>;
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
  tags?: Record<string, string>;
}

export interface SandboxClient {
  getOrCreate(params: SandboxClientParams): Promise<SandboxClientResult>;
}
