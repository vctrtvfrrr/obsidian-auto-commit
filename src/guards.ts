import type { TooltipKey } from "./tooltips";
import { execFileAsync, fsExistsSync, pathJoin } from "./node-apis";

const SPECIAL_STATE_GUARDS: [string, TooltipKey][] = [
  [".git/MERGE_HEAD", "failedMerge"],
  [".git/CHERRY_PICK_HEAD", "failedCherryPick"],
  [".git/REVERT_HEAD", "failedRevert"],
  [".git/BISECT_LOG", "failedBisect"],
];

// Runs before any command that changes state — in particular before `git add -A` —
// so an empty prompt never leaves the vault staged. Kept out of `checkRepoGuards`
// because that one also gates the fetch cycle, which needs no prompt.
export function checkPromptGuard(
  prompt: string
): { ok: false; reason: TooltipKey } | null {
  if (!prompt.trim()) {
    console.info("Auto-commit: skipped — commit message prompt is empty");
    return { ok: false, reason: "failedEmptyPrompt" };
  }
  return null;
}

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
