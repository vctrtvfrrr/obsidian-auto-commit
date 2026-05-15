export const TOOLTIPS = {
  idle: "Ready. Sync runs after the inactivity interval or via the Run now command.",
  syncing: "Syncing the repository…",
  noChanges: "No pending changes to commit.",
  okWithPush: "Commit created and changes pushed to the remote successfully.",
  okNoPush:
    "Commit created in the local repository only. Auto-push is disabled in settings.",
  failedUnexpected: "An unexpected error occurred. See the console for details.",
  failedMerge:
    "A merge is in progress. Complete or abort it manually before auto-sync.",
  failedCherryPick:
    "A cherry-pick is in progress. Complete or abort it manually before auto-sync.",
  failedRevert:
    "A revert is in progress. Complete or abort it manually before auto-sync.",
  failedBisect: "A bisect is in progress. Finish or abort it before auto-sync.",
  failedRebase:
    "A rebase is in progress. Complete or abort it manually before auto-sync.",
  failedDetached:
    "The repository is in detached HEAD state. Check out a branch before auto-sync.",
  failedDiffTooLarge:
    "The diff exceeded the 50 KB limit. Review and commit manually.",
  failedAi:
    "Could not generate the commit message with AI. Changes remain staged.",
  failedRebaseConflict:
    "Conflict while updating from remote; rebase was aborted. Resolve manually.",
  failedPush:
    "Push failed after local commit. Check credentials, network, and remote permissions.",
  failedGitStatus:
    "Could not check repository status with Git. See the console for details.",
  pulling: "Applying remote changes…",
  pulledOk: "Remote changes applied successfully.",
  failedPullConflict:
    "Could not apply remote changes; there are divergent local commits. Auto-sync will resolve it.",
} as const;

export type TooltipKey = keyof typeof TOOLTIPS;

export type SyncResult =
  | { ok: true; pushed: boolean }
  | { ok: false; reason: TooltipKey }
  | { ok: "noChanges" };
