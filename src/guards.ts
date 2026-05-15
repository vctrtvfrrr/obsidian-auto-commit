import type { TooltipKey } from "./tooltips";

const SPECIAL_STATE_GUARDS: [string, TooltipKey][] = [
  [".git/MERGE_HEAD", "failedMerge"],
  [".git/CHERRY_PICK_HEAD", "failedCherryPick"],
  [".git/REVERT_HEAD", "failedRevert"],
  [".git/BISECT_LOG", "failedBisect"],
];

export async function checkRepoGuards(
  cwd: string
): Promise<{ ok: false; reason: TooltipKey } | null> {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileP = promisify(execFile);
  for (const [f, reason] of SPECIAL_STATE_GUARDS) {
    if (existsSync(join(cwd, f))) {
      console.info(`Auto-commit: skipped — repo in special state (${f})`);
      return { ok: false, reason };
    }
  }

  if (
    existsSync(join(cwd, ".git/rebase-merge")) ||
    existsSync(join(cwd, ".git/rebase-apply"))
  ) {
    console.info("Auto-commit: skipped — rebase in progress");
    return { ok: false, reason: "failedRebase" };
  }

  try {
    await execFileP("git", ["symbolic-ref", "-q", "HEAD"], { cwd });
  } catch {
    console.info("Auto-commit: skipped — detached HEAD");
    return { ok: false, reason: "failedDetached" };
  }

  console.debug("Auto-commit: guards passed");
  return null;
}
