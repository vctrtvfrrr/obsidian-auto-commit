import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("obsidian", () => ({ Notice: vi.fn() }));
vi.mock("../node-apis", () => ({ execFileAsync: vi.fn() }));

import { execFileAsync } from "../node-apis";
import { syncRemote } from "../remote";

const execFileAsyncMock = vi.mocked(execFileAsync);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncRemote", () => {
  it("fetches, skips pull when not behind, and pushes", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "", stderr: "" })   // fetch
      .mockResolvedValueOnce({ stdout: "0", stderr: "" })  // rev-list count
      .mockResolvedValueOnce({ stdout: "", stderr: "" });  // push
    expect(await syncRemote("/repo", "origin", "main")).toEqual({ ok: true, pushed: true });
  });

  it("pulls with rebase when behind, then pushes", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "", stderr: "" })   // fetch
      .mockResolvedValueOnce({ stdout: "3", stderr: "" })  // rev-list: 3 commits behind
      .mockResolvedValueOnce({ stdout: "", stderr: "" })   // pull --rebase
      .mockResolvedValueOnce({ stdout: "", stderr: "" });  // push
    expect(await syncRemote("/repo", "origin", "main")).toEqual({ ok: true, pushed: true });
  });

  it("returns failedRebaseConflict when pull --rebase fails", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "", stderr: "" })          // fetch
      .mockResolvedValueOnce({ stdout: "2", stderr: "" })         // rev-list: behind
      .mockRejectedValueOnce(new Error("conflict"))               // pull --rebase fails
      .mockResolvedValueOnce({ stdout: "", stderr: "" });         // rebase --abort
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: false,
      reason: "failedRebaseConflict",
    });
  });

  it("returns failedPush when push fails", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "", stderr: "" })          // fetch
      .mockResolvedValueOnce({ stdout: "0", stderr: "" })         // rev-list: up to date
      .mockRejectedValueOnce(new Error("denied"));                // push fails
    expect(await syncRemote("/repo", "origin", "main")).toEqual({
      ok: false,
      reason: "failedPush",
    });
  });

  it("proceeds to push when remote branch does not exist yet", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "", stderr: "" })          // fetch
      .mockRejectedValueOnce(new Error("unknown"))                // rev-list: remote branch absent
      .mockResolvedValueOnce({ stdout: "", stderr: "" });         // push
    expect(await syncRemote("/repo", "origin", "main")).toEqual({ ok: true, pushed: true });
  });

  it("resolves current branch via symbolic-ref when branch arg is empty", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "develop\n", stderr: "" }) // symbolic-ref
      .mockResolvedValueOnce({ stdout: "", stderr: "" })          // fetch
      .mockResolvedValueOnce({ stdout: "0", stderr: "" })         // rev-list
      .mockResolvedValueOnce({ stdout: "", stderr: "" });         // push HEAD
    expect(await syncRemote("/repo", "origin", "")).toEqual({ ok: true, pushed: true });
  });
});
