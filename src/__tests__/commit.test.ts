import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("obsidian", () => ({ Notice: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
vi.mock("../ai", () => ({ generateCommitMessage: vi.fn() }));

import { execFile } from "node:child_process";
import { generateCommitMessage } from "../ai";
import { createCommit } from "../commit";

const execFileMock = vi.mocked(execFile);
const generateCommitMessageMock = vi.mocked(generateCommitMessage);

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

describe("createCommit", () => {
  it("returns failedGitStatus when git status fails", async () => {
    execFileMock.mockImplementationOnce(execFail());
    expect(await createCommit("/repo", "key")).toEqual({
      ok: false,
      reason: "failedGitStatus",
    });
  });

  it("returns noChanges when status output is empty", async () => {
    execFileMock.mockImplementationOnce(execOk(""));
    expect(await createCommit("/repo", "key")).toEqual({ ok: "noChanges" });
  });

  it("returns noChanges when status output is only whitespace", async () => {
    execFileMock.mockImplementationOnce(execOk("   \n"));
    expect(await createCommit("/repo", "key")).toEqual({ ok: "noChanges" });
  });

  it("returns failedDiffTooLarge when diff exceeds 50 KB", async () => {
    execFileMock
      .mockImplementationOnce(execOk("M notes.md"))
      .mockImplementationOnce(execOk(""))
      .mockImplementationOnce(execOk("x".repeat(50_001)));
    expect(await createCommit("/repo", "key")).toEqual({
      ok: false,
      reason: "failedDiffTooLarge",
    });
  });

  it("returns failedAi when generateCommitMessage throws", async () => {
    execFileMock
      .mockImplementationOnce(execOk("M notes.md"))
      .mockImplementationOnce(execOk(""))
      .mockImplementationOnce(execOk("small diff"));
    generateCommitMessageMock.mockRejectedValueOnce(new Error("AI down"));
    expect(await createCommit("/repo", "key")).toEqual({
      ok: false,
      reason: "failedAi",
    });
  });

  it("returns null on successful commit", async () => {
    execFileMock
      .mockImplementationOnce(execOk("M notes.md"))
      .mockImplementationOnce(execOk(""))
      .mockImplementationOnce(execOk("small diff"))
      .mockImplementationOnce(execOk(""));
    generateCommitMessageMock.mockResolvedValueOnce("Add meeting notes");
    expect(await createCommit("/repo", "key")).toBeNull();
  });

  it("accepts a diff of exactly 50 KB", async () => {
    execFileMock
      .mockImplementationOnce(execOk("M notes.md"))
      .mockImplementationOnce(execOk(""))
      .mockImplementationOnce(execOk("x".repeat(50_000)))
      .mockImplementationOnce(execOk(""));
    generateCommitMessageMock.mockResolvedValueOnce("Update notes");
    expect(await createCommit("/repo", "key")).toBeNull();
  });
});
