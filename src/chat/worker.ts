import { createBot } from "./bot";
import {
  DISCORD_GATEWAY_DURATION_MS,
  DISCORD_GATEWAY_PATH,
  DISCORD_INTERACTIONS_PATH,
} from "./constants";
import type { Env } from "../types/env";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  });
}

export async function handleFetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === DISCORD_INTERACTIONS_PATH) {
    console.log("Discord webhook request received");
    const bot = createBot(env);
    return bot.webhooks.discord(request, {
      waitUntil: ctx.waitUntil.bind(ctx),
    });
  }

  if (request.method === "GET" && url.pathname === DISCORD_GATEWAY_PATH) {
    return startDiscordGateway(env, ctx, "manual");
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json({
      ok: true,
      routes: [DISCORD_INTERACTIONS_PATH, DISCORD_GATEWAY_PATH],
      service: "flue-discord-demo",
    });
  }

  return new Response("Not found", { status: 404 });
}

export async function handleScheduled(
  _controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  console.log("Scheduled Discord gateway start requested");
  const response = await startDiscordGateway(env, ctx, "scheduled");

  if (!response.ok) {
    throw new Error(
      `Discord gateway listener failed to start: ${response.status} ${response.statusText}`,
    );
  }
}

async function startDiscordGateway(
  env: Env,
  ctx: ExecutionContext,
  source: "manual" | "scheduled",
): Promise<Response> {
  const bot = createBot(env);
  await bot.initialize();

  const discord = bot.getAdapter("discord");
  console.log("Starting Discord gateway listener", {
    durationMs: DISCORD_GATEWAY_DURATION_MS,
    source,
  });

  const response = await discord.startGatewayListener(
    { waitUntil: ctx.waitUntil.bind(ctx) },
    DISCORD_GATEWAY_DURATION_MS,
  );

  console.log("Discord gateway listener start response", {
    ok: response.ok,
    source,
    status: response.status,
    statusText: response.statusText,
  });

  return response;
}
