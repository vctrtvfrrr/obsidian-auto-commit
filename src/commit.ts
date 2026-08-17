import { Notice } from "obsidian";
import type { TooltipKey } from "./tooltips";
import type { AiConfig } from "./settings";
import { generateCommitMessage } from "./ai";
import { execFileAsync } from "./node-apis";

const PAYLOAD_LIMIT = 200_000;

export async function createCommit(
  cwd: string,
  ai: AiConfig
): Promise<{ ok: false; reason: TooltipKey } | { ok: "noChanges" } | null> {
  let statusOut: string;
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd });
    statusOut = stdout;
  } catch (err) {
    console.error("Auto-commit: git status failed", err);
    return { ok: false, reason: "failedGitStatus" };
  }

  if (!statusOut.trim()) return { ok: "noChanges" };

  const changedFiles = statusOut.trim().split("\n").length;
  console.info(`Auto-commit: ${changedFiles} changed file(s), staging`);

  await execFileAsync("git", ["add", "-A"], { cwd });

  const { stdout: contentDiff } = await execFileAsync(
    "git",
    ["diff", "--staged", "--", ":(exclude,top).obsidian/"],
    { cwd }
  );
  // Only `.obsidian/` changed: fall back to it so the message still describes something.
  const payload = contentDiff
    ? contentDiff
    : (await execFileAsync("git", ["diff", "--staged", "--", ".obsidian/"], { cwd })).stdout;
  // `git status` also reports changes `git add -A` cannot stage — a submodule with a
  // dirty worktree, for one. Nothing staged means nothing to commit.
  if (!payload) {
    console.info("Auto-commit: nothing staged after add, skipping");
    return { ok: "noChanges" };
  }

  const payloadBytes = new TextEncoder().encode(payload).length;
  console.debug(`Auto-commit: payload size = ${payloadBytes} bytes`);

  if (payloadBytes > PAYLOAD_LIMIT) {
    console.warn(`Auto-commit: payload too large (${payloadBytes} bytes), aborting`);
    new Notice(
      "Auto-commit: diff exceeds 200 KB. Review and commit manually via terminal.",
      0
    );
    return { ok: false, reason: "failedDiffTooLarge" };
  }

  let message: string;
  console.debug("Auto-commit: requesting commit message from AI");
  try {
    message = await generateCommitMessage(payload, ai);
    console.info(`Auto-commit: AI message — "${message}"`);
  } catch (err) {
    new Notice(
      "Auto-commit: failed to generate commit message (AI unavailable). Changes remain staged.",
      0
    );
    console.error("Auto-commit: AI error:", err);
    return { ok: false, reason: "failedAi" };
  }

  await execFileAsync("git", ["commit", "-m", message], { cwd });
  console.info("Auto-commit: commit created");
  return null;
}
