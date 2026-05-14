import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectSetupCommand,
  buildProjectSetupPlan,
  prepareProjectCheckout,
} from "./project-setup";
import type { SandboxCommandParams, SandboxWorkspace } from "../types/sandbox";
import type { ThreadMetadata } from "../types/thread-metadata";

const metadata: ThreadMetadata = {
  flueSessionId: "thread-123",
  lastError: null,
  projectPath: "/workspace/weather_starter",
  repoUrl: "https://github.com/AISG-AIAP/weather_starter.git",
  sandbox: {
    name: "discord-thread-123",
    tags: {
      app: "flue-discord-demo",
      discordChannelId: "channel-123",
      discordThreadId: "thread-123",
      lifecycle: "demo",
      repo: "weather-starter",
    },
  },
  setup: {
    completed: false,
  },
  status: "pending",
};

test("buildProjectSetupPlan uses deterministic thread metadata values", () => {
  assert.deepEqual(buildProjectSetupPlan(metadata), {
    projectPath: "/workspace/weather_starter",
    repoUrl: "https://github.com/AISG-AIAP/weather_starter.git",
  });
});

test("buildProjectSetupCommand is clone-only and skips existing checkouts", () => {
  const command = buildProjectSetupCommand(buildProjectSetupPlan(metadata));
  const script = command.args?.at(1) ?? "";

  assert.equal(command.cmd, "sh");
  assert.deepEqual(command.env, {
    PROJECT_PATH: "/workspace/weather_starter",
    REPO_URL: "https://github.com/AISG-AIAP/weather_starter.git",
  });
  assert.match(script, /mkdir -p/);
  assert.match(script, /\[ ! -d "\$PROJECT_PATH\/\.git" \]/);
  assert.match(script, /git clone --depth 1 "\$REPO_URL" "\$PROJECT_PATH"/);
  assert.doesNotMatch(script, /npm|pnpm|yarn|bun|commit|push|deploy/);
});

test("prepareProjectCheckout runs the plan against a fake workspace", async () => {
  const commands: SandboxCommandParams[] = [];
  const workspace = createWorkspace(async (params) => {
    commands.push(params);

    return {
      exitCode: 0,
    };
  });

  await prepareProjectCheckout(workspace, buildProjectSetupPlan(metadata));

  assert.equal(commands.length, 1);
});

test("prepareProjectCheckout includes command output on failure", async () => {
  const workspace = createWorkspace(async () => ({
    exitCode: 1,
    stderr: "clone failed",
  }));

  await assert.rejects(
    () => prepareProjectCheckout(workspace, buildProjectSetupPlan(metadata)),
    /Project setup failed.*clone failed/,
  );
});

function createWorkspace(
  runCommand: SandboxWorkspace["runCommand"],
): SandboxWorkspace {
  return {
    name: "discord-thread-123",
    persistent: true,
    runCommand,
    tags: metadata.sandbox.tags,
  };
}
