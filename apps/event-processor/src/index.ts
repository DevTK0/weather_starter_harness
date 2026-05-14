export { ChatStateDO } from "chat-state-cloudflare-do";

import { handleFetch } from "./chat/worker";
import type { Env } from "./types/env";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handleFetch(request, env, ctx);
  },
};
