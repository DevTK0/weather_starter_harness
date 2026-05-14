export const DISCORD_INTERACTIONS_PATH = "/webhooks/discord";

export const CHAT_CONCURRENCY = {
  strategy: "queue",
  maxQueueSize: 10,
  onQueueFull: "drop-oldest",
  queueEntryTtlMs: 10 * 60 * 1000,
} as const;

export const PLACEHOLDER_READY_MESSAGE =
  "Plumbing check received. The Discord chat layer is wired up, but implementation is not enabled yet.";

export const PLACEHOLDER_FAILURE_MESSAGE =
  "Plumbing check failed before implementation started.";
