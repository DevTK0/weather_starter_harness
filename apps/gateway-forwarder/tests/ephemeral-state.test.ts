import assert from "node:assert/strict";
import test from "node:test";

import { createEphemeralState } from "../src/ephemeral-state";

test("supports the Chat SDK state operations needed during initialization", async () => {
  const state = createEphemeralState();
  await state.connect();

  await state.set("thread:1", { ready: true });
  assert.deepEqual(await state.get("thread:1"), { ready: true });

  assert.equal(await state.setIfNotExists("thread:1", { ready: false }), false);
  assert.equal(await state.setIfNotExists("thread:2", { ready: true }), true);

  const lock = await state.acquireLock("thread:1", 1_000);
  assert.ok(lock);
  assert.equal(await state.acquireLock("thread:1", 1_000), null);
  await state.releaseLock(lock);
  assert.ok(await state.acquireLock("thread:1", 1_000));
});
