import type { SandboxCommandParams, SandboxCommandResult, SandboxWorkspace } from "../types/sandbox";
import type { ThreadMetadata } from "../types/thread-metadata";

export interface ProjectSetupPlan {
  projectPath: string;
  repoUrl: string;
}

export function buildProjectSetupPlan(
  metadata: Pick<ThreadMetadata, "projectPath" | "repoUrl">,
): ProjectSetupPlan {
  return {
    projectPath: metadata.projectPath,
    repoUrl: metadata.repoUrl,
  };
}

export function buildProjectSetupCommand(
  plan: ProjectSetupPlan,
): SandboxCommandParams {
  return {
    cmd: "sh",
    args: [
      "-lc",
      [
        "set -eu",
        'mkdir -p "$(dirname "$PROJECT_PATH")"',
        'if [ ! -d "$PROJECT_PATH/.git" ]; then',
        '  if [ -e "$PROJECT_PATH" ]; then',
        '    echo "Project path exists but is not a git checkout: $PROJECT_PATH" >&2',
        "    exit 1",
        "  fi",
        '  git clone --depth 1 "$REPO_URL" "$PROJECT_PATH"',
        "fi",
      ].join("\n"),
    ],
    env: {
      PROJECT_PATH: plan.projectPath,
      REPO_URL: plan.repoUrl,
    },
  };
}

export async function prepareProjectCheckout(
  workspace: SandboxWorkspace,
  plan: ProjectSetupPlan,
): Promise<void> {
  const result = await workspace.runCommand(buildProjectSetupCommand(plan));

  if (result.exitCode !== 0) {
    throw new Error(
      `Project setup failed for "${plan.projectPath}": ${formatCommandFailure(result)}`,
    );
  }
}

function formatCommandFailure(result: SandboxCommandResult): string {
  const detail = [result.stderr, result.stdout]
    .filter((value) => value && value.trim())
    .join("\n")
    .trim();

  return detail || `command exited with code ${result.exitCode}`;
}
