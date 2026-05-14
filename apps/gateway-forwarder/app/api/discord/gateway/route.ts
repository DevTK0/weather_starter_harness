import { after } from "next/server";

import { createGatewayForwarderChat } from "../../../../src/bot";
import {
  GATEWAY_LISTENER_DURATION_MS,
  resolveGatewayForwarderConfig,
} from "../../../../src/config";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const config = resolveGatewayForwarderConfig(process.env);

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bot = createGatewayForwarderChat(config);
  await bot.initialize();

  const discord = bot.getAdapter("discord");
  console.info("Starting Discord Gateway forwarder", {
    durationMs: GATEWAY_LISTENER_DURATION_MS,
    webhookUrl: config.cloudflareDiscordWebhookUrl,
  });

  return discord.startGatewayListener(
    { waitUntil: (task) => after(() => task) },
    GATEWAY_LISTENER_DURATION_MS,
    undefined,
    config.cloudflareDiscordWebhookUrl,
  );
}
