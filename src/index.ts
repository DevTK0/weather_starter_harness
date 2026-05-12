export { ChatStateDO } from "chat-state-cloudflare-do";

import { handleFetch, handleScheduled } from "./chat/worker";
import type { Env } from "./types/env";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handleFetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    await handleScheduled(controller, env, ctx);
  },
};
