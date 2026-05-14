import assert from "node:assert/strict";
import test from "node:test";

import { formatMessageBatchPrompt } from "./message-batch";

function createMessage(text: string) {
  return {
    author: {
      isBot: false,
    },
    text,
  };
}

test("formats a single message as the latest Discord message", () => {
  const prompt = formatMessageBatchPrompt({
    currentMessage: createMessage("inspect the router") as never,
    projectPath: "/vercel/sandbox/weather_starter",
  });

  assert.equal(
    prompt,
    [
      "You are the Implementation Agent for the Discord Implementation Harness.",
      "Work in the configured weather_starter project path: /vercel/sandbox/weather_starter",
      "Use this latest Discord message as the instruction for this Work Cycle:",
      "inspect the router",
    ].join("\n\n"),
  );
});

test("formats queued Message Batch messages in chronological order", () => {
  const prompt = formatMessageBatchPrompt({
    context: {
      skipped: [
        createMessage("make the homepage blue") as never,
        createMessage("actually use the theme tokens") as never,
      ],
      totalSinceLastHandler: 3,
    },
    currentMessage: createMessage("and add a toggle") as never,
    projectPath: "/vercel/sandbox/weather_starter",
  });

  assert.equal(
    prompt,
    [
      "You are the Implementation Agent for the Discord Implementation Harness.",
      "Work in the configured weather_starter project path: /vercel/sandbox/weather_starter",
      "Use this chronological Message Batch as the latest instruction sequence for this Work Cycle.",
      "Later messages can refine or replace earlier messages.",
      "1. make the homepage blue\n2. actually use the theme tokens\n3. and add a toggle",
    ].join("\n\n"),
  );
});
