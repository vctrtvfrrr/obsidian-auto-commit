import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../node-apis", () => ({
  execFileAsync: vi.fn(),
  fsExistsSync: vi.fn(),
  pathJoin: (...parts: string[]) => parts.join("/"),
}));

import { execFileAsync, fsExistsSync } from "../node-apis";
import { checkRepoGuards } from "../guards";

const execFileAsyncMock = vi.mocked(execFileAsync);
const fsExistsSyncMock = vi.mocked(fsExistsSync);

beforeEach(() => {
  vi.resetAllMocks();
  fsExistsSyncMock.mockReturnValue(false);
  execFileAsyncMock.mockResolvedValue({ stdout: "refs/heads/main", stderr: "" });
});

describe("checkRepoGuards", () => {
  it("returns null when repo is clean", async () => {
    expect(await checkRepoGuards("/repo")).toBeNull();
  });

  it("detects MERGE_HEAD", async () => {
    fsExistsSyncMock.mockImplementation((p) => String(p).endsWith("MERGE_HEAD"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedMerge" });
  });

  it("detects CHERRY_PICK_HEAD", async () => {
    fsExistsSyncMock.mockImplementation((p) => String(p).endsWith("CHERRY_PICK_HEAD"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedCherryPick" });
  });

  it("detects REVERT_HEAD", async () => {
    fsExistsSyncMock.mockImplementation((p) => String(p).endsWith("REVERT_HEAD"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedRevert" });
  });

  it("detects BISECT_LOG", async () => {
    fsExistsSyncMock.mockImplementation((p) => String(p).endsWith("BISECT_LOG"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedBisect" });
  });

  it("detects rebase-merge in progress", async () => {
    fsExistsSyncMock.mockImplementation((p) => String(p).endsWith("rebase-merge"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedRebase" });
  });

  it("detects rebase-apply in progress", async () => {
    fsExistsSyncMock.mockImplementation((p) => String(p).endsWith("rebase-apply"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedRebase" });
  });

  it("detects detached HEAD", async () => {
    execFileAsyncMock.mockRejectedValueOnce(new Error("fatal: ref HEAD is not a symbolic ref"));
    expect(await checkRepoGuards("/repo")).toEqual({ ok: false, reason: "failedDetached" });
  });
});
