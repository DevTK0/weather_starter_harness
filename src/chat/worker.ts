import { createBot } from "./bot";
import {
  DISCORD_GATEWAY_DURATION_MS,
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
    const bot = createBot(env);
    return bot.webhooks.discord(request, {
      waitUntil: ctx.waitUntil.bind(ctx),
    });
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json({
      ok: true,
      routes: [DISCORD_INTERACTIONS_PATH],
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
  const bot = createBot(env);
  await bot.initialize();

  const discord = bot.getAdapter("discord");
  const response = await discord.startGatewayListener(
    { waitUntil: ctx.waitUntil.bind(ctx) },
    DISCORD_GATEWAY_DURATION_MS,
  );

  if (!response.ok) {
    throw new Error(
      `Discord gateway listener failed to start: ${response.status} ${response.statusText}`,
    );
  }
}

