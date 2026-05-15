import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Notice } from "obsidian";
import type { TooltipKey } from "./tooltips";

const execFileP = promisify(execFile);

export async function syncRemote(
  cwd: string,
  remote: string,
  branch: string
): Promise<TooltipKey | null> {
  const effectiveBranch =
    branch ||
    (
      await execFileP("git", ["symbolic-ref", "--short", "HEAD"], { cwd })
    ).stdout.trim();

  await execFileP("git", ["fetch", remote], { cwd });

  try {
    const { stdout: aheadCount } = await execFileP(
      "git",
      ["rev-list", `HEAD..${remote}/${effectiveBranch}`, "--count"],
      { cwd }
    );
    if (parseInt(aheadCount.trim(), 10) > 0) {
      try {
        await execFileP("git", ["pull", "--rebase", remote, effectiveBranch], { cwd });
      } catch {
        await execFileP("git", ["rebase", "--abort"], { cwd }).catch(() => {});
        new Notice(
          "Auto-commit: conflito com remoto. Rebase abortado. Resolva manualmente.",
          0
        );
        return "failedRebaseConflict";
      }
    }
  } catch {
    // Remote branch may not exist yet; proceed to push
  }

  try {
    const pushArgs = branch
      ? ["push", remote, effectiveBranch]
      : ["push", remote, "HEAD"];
    await execFileP("git", pushArgs, { cwd });
    return null;
  } catch (err) {
    new Notice(
      "Auto-commit: push falhou. Commit local feito mas não enviado. Verifique credenciais/rede.",
      0
    );
    console.error("Auto-commit: push error:", err);
    return "failedPush";
  }
}
