import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("obsidian", () => ({ Notice: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

import { execFile } from "node:child_process";
import { syncRemote } from "../remote";

const execFileMock = vi.mocked(execFile);

function execOk(stdout = "") {
  return (_a: any, _b: any, _c: any, cb: any) =>
    cb(null, { stdout, stderr: "" });
}

function execFail(msg = "git error") {
  return (_a: any, _b: any, _c: any, cb: any) => cb(new Error(msg));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncRemote", () => {
  it("fetches, skips pull when not behind, and pushes", async () => {
    execFileMock
      .mockImplementationOnce(execOk("fetch ok"))    // fetch
      .mockImplementationOnce(execOk("0"))           // rev-list count
      .mockImplementationOnce(execOk("push ok"));    // push
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: true,
      pushed: true,
    });
  });

  it("pulls with rebase when behind, then pushes", async () => {
    execFileMock
      .mockImplementationOnce(execOk(""))            // fetch
      .mockImplementationOnce(execOk("3"))           // rev-list: 3 commits behind
      .mockImplementationOnce(execOk(""))            // pull --rebase
      .mockImplementationOnce(execOk(""));           // push
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: true,
      pushed: true,
    });
  });

  it("returns failedRebaseConflict when pull --rebase fails", async () => {
    execFileMock
      .mockImplementationOnce(execOk(""))            // fetch
      .mockImplementationOnce(execOk("2"))           // rev-list: behind
      .mockImplementationOnce(execFail("conflict"))  // pull --rebase fails
      .mockImplementationOnce(execOk(""));           // rebase --abort
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: false,
      reason: "failedRebaseConflict",
    });
  });

  it("returns failedPush when push fails", async () => {
    execFileMock
      .mockImplementationOnce(execOk(""))            // fetch
      .mockImplementationOnce(execOk("0"))           // rev-list: up to date
      .mockImplementationOnce(execFail("denied"));   // push fails
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: false,
      reason: "failedPush",
    });
  });

  it("proceeds to push when remote branch does not exist yet", async () => {
    execFileMock
      .mockImplementationOnce(execOk(""))            // fetch
      .mockImplementationOnce(execFail("unknown"))   // rev-list: remote branch absent
      .mockImplementationOnce(execOk(""));           // push
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: true,
      pushed: true,
    });
  });

  it("resolves current branch via symbolic-ref when branch arg is empty", async () => {
    execFileMock
      .mockImplementationOnce(execOk("develop\n"))   // symbolic-ref
      .mockImplementationOnce(execOk(""))            // fetch
      .mockImplementationOnce(execOk("0"))           // rev-list
      .mockImplementationOnce(execOk(""));           // push HEAD
    expect(await syncRemote("/repo", "origin", "")).toEqual({
      ok: true,
      pushed: true,
    });
  });
});
