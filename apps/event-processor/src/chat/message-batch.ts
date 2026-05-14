import type { Message, MessageContext } from "chat";

export interface MessageBatchPromptInput {
  context?: MessageContext;
  currentMessage: Message;
  projectPath: string;
}

function getMessageBatch(
  currentMessage: Message,
  context?: MessageContext,
): Message[] {
  return [...(context?.skipped ?? []), currentMessage];
}

function formatMessageList(messages: Message[]): string {
  return messages
    .map((message, index) => `${index + 1}. ${message.text}`)
    .join("\n");
}

export function formatMessageBatchPrompt({
  context,
  currentMessage,
  projectPath,
}: MessageBatchPromptInput): string {
  const messages = getMessageBatch(currentMessage, context);

  if (messages.length === 1) {
    return [
      "You are the Implementation Agent for the Discord Implementation Harness.",
      `Work in the configured weather_starter project path: ${projectPath}`,
      "Use this latest Discord message as the instruction for this Work Cycle:",
      currentMessage.text,
    ].join("\n\n");
  }

  return [
    "You are the Implementation Agent for the Discord Implementation Harness.",
    `Work in the configured weather_starter project path: ${projectPath}`,
    "Use this chronological Message Batch as the latest instruction sequence for this Work Cycle.",
    "Later messages can refine or replace earlier messages.",
    formatMessageList(messages),
  ].join("\n\n");
}
