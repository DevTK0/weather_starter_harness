import { createDiscordAdapter } from "@chat-adapter/discord";
import { Chat } from "chat";

import type { GatewayForwarderConfig } from "./config";
import { createEphemeralState } from "./ephemeral-state";

export function createGatewayForwarderChat(config: GatewayForwarderConfig) {
  const adapters = {
    discord: createDiscordAdapter({
      applicationId: config.discordApplicationId,
      botToken: config.discordBotToken,
      publicKey: config.discordPublicKey,
      userName: config.userName,
    }),
  };

  return new Chat({
    userName: config.userName,
    adapters,
    logger: "info",
    state: createEphemeralState(),
  });
}
