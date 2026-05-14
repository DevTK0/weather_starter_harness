import type { StateAdapter } from "chat";

const GATEWAY_DEDUPE_TTL_MS = 15 * 60 * 1000;

interface ForwardedGatewayEvent {
  data?: {
    id?: unknown;
  };
  type?: unknown;
}

export function getForwardedGatewayEventDedupeKey(
  event: ForwardedGatewayEvent,
): string | null {
  if (typeof event.type !== "string" || !event.type.startsWith("GATEWAY_")) {
    return null;
  }

  if (typeof event.data?.id !== "string" || event.data.id.length === 0) {
    return null;
  }

  return `gateway-dedupe:${event.type}:${event.data.id}`;
}

export async function shouldProcessForwardedGatewayEvent(
  event: ForwardedGatewayEvent,
  state: Pick<StateAdapter, "setIfNotExists">,
): Promise<boolean> {
  const key = getForwardedGatewayEventDedupeKey(event);

  if (!key) {
    return true;
  }

  return state.setIfNotExists(key, true, GATEWAY_DEDUPE_TTL_MS);
}
