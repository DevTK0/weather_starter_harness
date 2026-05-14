export type ThreadRunStatus = "pending" | "running" | "complete" | "failed";

export interface ThreadSandboxTags {
  app: string;
  discordChannelId: string;
  discordThreadId: string;
  lifecycle: string;
  repo: string;
}

export interface ThreadSandboxMetadata {
  name: string;
  tags: ThreadSandboxTags;
}

export interface ThreadSetupMetadata {
  completed: boolean;
}

export interface ThreadMetadata {
  flueSessionId: string;
  lastError: string | null;
  projectPath: string;
  repoUrl: string;
  sandbox: ThreadSandboxMetadata;
  setup: ThreadSetupMetadata;
  status: ThreadRunStatus;
}

export interface ThreadMetadataUpdate {
  flueSessionId?: string;
  lastError?: string | null;
  projectPath?: string;
  repoUrl?: string;
  sandbox?: Partial<ThreadSandboxMetadata> & {
    tags?: Partial<ThreadSandboxTags>;
  };
  setup?: Partial<ThreadSetupMetadata>;
  status?: ThreadRunStatus;
}

export interface ThreadIdentity {
  channelId: string;
  id: string;
}
