const DEFAULT_USER_NAME = "flue-discord-demo";

export const GATEWAY_LISTENER_DURATION_MS = 10 * 60 * 1000;

export interface GatewayForwarderConfig {
  cloudflareDiscordWebhookUrl: string;
  cronSecret: string;
  discordApplicationId: string;
  discordBotToken: string;
  discordPublicKey: string;
  userName: string;
}

type EnvSource = Partial<Record<string, string | undefined>>;

export function resolveGatewayForwarderConfig(
  env: EnvSource,
): GatewayForwarderConfig {
  return {
    cloudflareDiscordWebhookUrl: requireEnv(
      env,
      "CLOUDFLARE_DISCORD_WEBHOOK_URL",
    ),
    cronSecret: requireEnv(env, "CRON_SECRET"),
    discordApplicationId: requireEnv(env, "DISCORD_APPLICATION_ID"),
    discordBotToken: requireEnv(env, "DISCORD_BOT_TOKEN"),
    discordPublicKey: requireEnv(env, "DISCORD_PUBLIC_KEY"),
    userName: env.DISCORD_GATEWAY_USER_NAME ?? DEFAULT_USER_NAME,
  };
}

function requireEnv(env: EnvSource, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Gateway Forwarder`);
  }
  return value;
}
