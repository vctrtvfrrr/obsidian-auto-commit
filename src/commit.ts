import { Notice } from "obsidian";
import type { TooltipKey } from "./tooltips";
import { generateCommitMessage } from "./ai";

export async function createCommit(
  cwd: string,
  apiKey: string
): Promise<{ ok: false; reason: TooltipKey } | { ok: "noChanges" } | null> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileP = promisify(execFile);
  let statusOut: string;
  try {
    const { stdout } = await execFileP("git", ["status", "--porcelain"], { cwd });
    statusOut = stdout;
  } catch (err) {
    console.error("Auto-commit: git status failed", err);
    return { ok: false, reason: "failedGitStatus" };
  }

  if (!statusOut.trim()) return { ok: "noChanges" };

  const changedFiles = statusOut.trim().split("\n").length;
  console.info(`Auto-commit: ${changedFiles} changed file(s), staging`);

  await execFileP("git", ["add", "-A"], { cwd });

  const { stdout: diff } = await execFileP("git", ["diff", "--staged"], { cwd });
  console.debug(`Auto-commit: staged diff size = ${diff.length} bytes`);

  if (diff.length > 50_000) {
    console.warn(`Auto-commit: diff too large (${diff.length} bytes), aborting`);
    new Notice(
      "Auto-commit: diff exceeds 50 KB. Review and commit manually via terminal.",
      0
    );
    return { ok: false, reason: "failedDiffTooLarge" };
  }

  let message: string;
  console.debug("Auto-commit: requesting commit message from AI");
  try {
    message = await generateCommitMessage(diff, apiKey);
    console.info(`Auto-commit: AI message — "${message}"`);
  } catch (err) {
    new Notice(
      "Auto-commit: failed to generate commit message (AI unavailable). Changes remain staged.",
      0
    );
    console.error("Auto-commit: AI error:", err);
    return { ok: false, reason: "failedAi" };
  }

  await execFileP("git", ["commit", "-m", message], { cwd });
  console.info("Auto-commit: commit created");
  return null;
}
