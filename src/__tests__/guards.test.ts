import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { checkRepoGuards } from "../guards";

const existsSyncMock = vi.mocked(existsSync);
const execFileMock = vi.mocked(execFile);

function makeExecFileOk() {
  execFileMock.mockImplementation((_a: any, _b: any, _c: any, cb: any) =>
    cb(null, { stdout: "refs/heads/main", stderr: "" })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  existsSyncMock.mockReturnValue(false);
  makeExecFileOk();
});

describe("checkRepoGuards", () => {
  it("returns null when repo is clean", async () => {
    expect(await checkRepoGuards("/repo")).toBeNull();
  });

  it("detects MERGE_HEAD", async () => {
    existsSyncMock.mockImplementation((p) =>
      String(p).endsWith(".git/MERGE_HEAD")
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedMerge",
    });
  });

  it("detects CHERRY_PICK_HEAD", async () => {
    existsSyncMock.mockImplementation((p) =>
      String(p).endsWith(".git/CHERRY_PICK_HEAD")
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedCherryPick",
    });
  });

  it("detects REVERT_HEAD", async () => {
    existsSyncMock.mockImplementation((p) =>
      String(p).endsWith(".git/REVERT_HEAD")
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedRevert",
    });
  });

  it("detects BISECT_LOG", async () => {
    existsSyncMock.mockImplementation((p) =>
      String(p).endsWith(".git/BISECT_LOG")
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedBisect",
    });
  });

  it("detects rebase-merge in progress", async () => {
    existsSyncMock.mockImplementation((p) =>
      String(p).endsWith(".git/rebase-merge")
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedRebase",
    });
  });

  it("detects rebase-apply in progress", async () => {
    existsSyncMock.mockImplementation((p) =>
      String(p).endsWith(".git/rebase-apply")
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedRebase",
    });
  });

  it("detects detached HEAD", async () => {
    execFileMock.mockImplementation((_a: any, _b: any, _c: any, cb: any) =>
      cb(new Error("fatal: ref HEAD is not a symbolic ref"))
    );
    expect(await checkRepoGuards("/repo")).toEqual({
      ok: false,
      reason: "failedDetached",
    });
  });
});
