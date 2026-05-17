import { Notice } from "obsidian";
import type { TooltipKey } from "./tooltips";
import { execFileAsync } from "./node-apis";

export async function syncRemote(
  cwd: string,
  remote: string,
  branch: string
): Promise<{ ok: true; pushed: true } | { ok: false; reason: TooltipKey }> {
  const effectiveBranch =
    branch ||
    (await execFileAsync("git", ["symbolic-ref", "--short", "HEAD"], { cwd })).stdout.trim();
  console.debug(`Auto-commit: syncing to ${remote}/${effectiveBranch}`);

  console.debug(`Auto-commit: fetching ${remote}`);
  await execFileAsync("git", ["fetch", remote], { cwd });

  try {
    const { stdout: aheadCount } = await execFileAsync(
      "git",
      ["rev-list", `HEAD..${remote}/${effectiveBranch}`, "--count"],
      { cwd }
    );
    const count = parseInt(aheadCount.trim(), 10);
    if (count > 0) {
      console.info(`Auto-commit: remote is ${count} commit(s) ahead, rebasing`);
      try {
        await execFileAsync("git", ["pull", "--rebase", remote, effectiveBranch], { cwd });
        console.info("Auto-commit: rebase successful");
      } catch (err) {
        console.warn("Auto-commit: rebase conflict, aborting", err);
        await execFileAsync("git", ["rebase", "--abort"], { cwd }).catch(() => {});
        new Notice(
          "Auto-commit: conflict while updating from remote. Rebase aborted. Resolve manually.",
          0
        );
        return { ok: false, reason: "failedRebaseConflict" };
      }
    } else {
      console.debug("Auto-commit: remote is up to date, no rebase needed");
    }
  } catch {
    console.debug(`Auto-commit: ${remote}/${effectiveBranch} not found, skipping rebase check`);
  }

  try {
    const pushArgs = branch
      ? ["push", remote, effectiveBranch]
      : ["push", remote, "HEAD"];
    console.debug(`Auto-commit: pushing (${pushArgs.join(" ")})`);
    await execFileAsync("git", pushArgs, { cwd });
    console.info(`Auto-commit: pushed to ${remote}/${effectiveBranch}`);
    return { ok: true, pushed: true };
  } catch (err) {
    new Notice(
      "Auto-commit: push failed. Local commit created but not pushed. Check credentials and network.",
      0
    );
    console.error("Auto-commit: push error:", err);
    return { ok: false, reason: "failedPush" };
  }
}
