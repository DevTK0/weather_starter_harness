import { createBot } from "./bot";
import { DISCORD_INTERACTIONS_PATH } from "./constants";
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

  if (request.method === "GET" && url.pathname === "/healthz") {
    return json({
      ok: true,
      routes: [DISCORD_INTERACTIONS_PATH, "/healthz"],
      service: "flue-discord-demo",
    });
  }

  return new Response("Not found", { status: 404 });
}
