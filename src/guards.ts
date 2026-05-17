import type { TooltipKey } from "./tooltips";
import { execFileAsync, fsExistsSync, pathJoin } from "./node-apis";

const SPECIAL_STATE_GUARDS: [string, TooltipKey][] = [
  [".git/MERGE_HEAD", "failedMerge"],
  [".git/CHERRY_PICK_HEAD", "failedCherryPick"],
  [".git/REVERT_HEAD", "failedRevert"],
  [".git/BISECT_LOG", "failedBisect"],
];

export async function checkRepoGuards(
  cwd: string
): Promise<{ ok: false; reason: TooltipKey } | null> {
  for (const [f, reason] of SPECIAL_STATE_GUARDS) {
    if (fsExistsSync(pathJoin(cwd, f))) {
      console.info(`Auto-commit: skipped — repo in special state (${f})`);
      return { ok: false, reason };
    }
  }

  if (
    fsExistsSync(pathJoin(cwd, ".git/rebase-merge")) ||
    fsExistsSync(pathJoin(cwd, ".git/rebase-apply"))
  ) {
    console.info("Auto-commit: skipped — rebase in progress");
    return { ok: false, reason: "failedRebase" };
  }

  try {
    await execFileAsync("git", ["symbolic-ref", "-q", "HEAD"], { cwd });
  } catch {
    console.info("Auto-commit: skipped — detached HEAD");
    return { ok: false, reason: "failedDetached" };
  }

  console.debug("Auto-commit: guards passed");
  return null;
}
