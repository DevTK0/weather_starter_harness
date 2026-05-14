import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GATEWAY_LISTENER_DURATION_MS,
  resolveGatewayForwarderConfig,
} from "../src/config";

const completeEnv = {
  CLOUDFLARE_DISCORD_WEBHOOK_URL:
    "https://example.workers.dev/webhooks/discord",
  CRON_SECRET: "test-cron-secret",
  DISCORD_APPLICATION_ID: "app-id",
  DISCORD_BOT_TOKEN: "bot-token",
  DISCORD_PUBLIC_KEY: "public-key",
};

test("resolves Gateway Forwarder config from environment", () => {
  assert.deepEqual(resolveGatewayForwarderConfig(completeEnv), {
    cloudflareDiscordWebhookUrl:
      "https://example.workers.dev/webhooks/discord",
    cronSecret: "test-cron-secret",
    discordApplicationId: "app-id",
    discordBotToken: "bot-token",
    discordPublicKey: "public-key",
    userName: "flue-discord-demo",
  });
});

test("allows the Discord adapter user name to be overridden", () => {
  const config = resolveGatewayForwarderConfig({
    ...completeEnv,
    DISCORD_GATEWAY_USER_NAME: "gateway-forwarder",
  });

  assert.equal(config.userName, "gateway-forwarder");
});

test("fails fast when the Cloudflare Discord webhook URL is missing", () => {
  assert.throws(
    () =>
      resolveGatewayForwarderConfig({
        ...completeEnv,
        CLOUDFLARE_DISCORD_WEBHOOK_URL: "",
      }),
    /CLOUDFLARE_DISCORD_WEBHOOK_URL is required/,
  );
});

test("keeps the listener window at ten minutes", () => {
  assert.equal(GATEWAY_LISTENER_DURATION_MS, 600_000);
});

test("configures the Vercel cron to restart the Gateway listener every nine minutes", async () => {
  const vercelConfig = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(vercelConfig.crons, [
    {
      path: "/api/discord/gateway",
      schedule: "*/9 * * * *",
    },
  ]);
});
