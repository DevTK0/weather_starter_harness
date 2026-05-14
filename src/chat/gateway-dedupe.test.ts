import assert from "node:assert/strict";
import test from "node:test";

import {
  getForwardedGatewayEventDedupeKey,
  shouldProcessForwardedGatewayEvent,
} from "./gateway-dedupe";

test("builds a dedupe key for forwarded Gateway events with ids", () => {
  assert.equal(
    getForwardedGatewayEventDedupeKey({
      data: { id: "message-123" },
      type: "GATEWAY_MESSAGE_CREATE",
    }),
    "gateway-dedupe:GATEWAY_MESSAGE_CREATE:message-123",
  );
});

test("does not dedupe non-Gateway events or Gateway events without ids", () => {
  assert.equal(
    getForwardedGatewayEventDedupeKey({
      data: { id: "interaction-123" },
      type: "INTERACTION_CREATE",
    }),
    null,
  );
  assert.equal(
    getForwardedGatewayEventDedupeKey({
      data: {},
      type: "GATEWAY_READY",
    }),
    null,
  );
});

test("atomically drops duplicate forwarded Gateway events", async () => {
  const seen = new Set<string>();
  const state = {
    async setIfNotExists(key: string) {
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    },
  };
  const event = {
    data: { id: "message-123" },
    type: "GATEWAY_MESSAGE_CREATE",
  };

  assert.equal(await shouldProcessForwardedGatewayEvent(event, state), true);
  assert.equal(await shouldProcessForwardedGatewayEvent(event, state), false);
});
