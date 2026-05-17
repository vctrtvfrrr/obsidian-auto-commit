import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("obsidian", () => ({ Notice: vi.fn() }));
vi.mock("../node-apis", () => ({ execFileAsync: vi.fn() }));
vi.mock("../ai", () => ({ generateCommitMessage: vi.fn() }));

import { execFileAsync } from "../node-apis";
import { generateCommitMessage } from "../ai";
import { createCommit } from "../commit";

const execFileAsyncMock = vi.mocked(execFileAsync);
const generateCommitMessageMock = vi.mocked(generateCommitMessage);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createCommit", () => {
  it("returns failedGitStatus when git status fails", async () => {
    execFileAsyncMock.mockRejectedValueOnce(new Error("git error"));
    expect(await createCommit("/repo", "key")).toEqual({ ok: false, reason: "failedGitStatus" });
  });

  it("returns noChanges when status output is empty", async () => {
    execFileAsyncMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
    expect(await createCommit("/repo", "key")).toEqual({ ok: "noChanges" });
  });

  it("returns noChanges when status output is only whitespace", async () => {
    execFileAsyncMock.mockResolvedValueOnce({ stdout: "   \n", stderr: "" });
    expect(await createCommit("/repo", "key")).toEqual({ ok: "noChanges" });
  });

  it("returns failedDiffTooLarge when diff exceeds 50 KB", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })  // status
      .mockResolvedValueOnce({ stdout: "", stderr: "" })             // add -A
      .mockResolvedValueOnce({ stdout: "x".repeat(50_001), stderr: "" }); // diff
    expect(await createCommit("/repo", "key")).toEqual({ ok: false, reason: "failedDiffTooLarge" });
  });

  it("returns failedAi when generateCommitMessage throws", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "small diff", stderr: "" });
    generateCommitMessageMock.mockRejectedValueOnce(new Error("AI down"));
    expect(await createCommit("/repo", "key")).toEqual({ ok: false, reason: "failedAi" });
  });

  it("returns null on successful commit", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "small diff", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Add meeting notes");
    expect(await createCommit("/repo", "key")).toBeNull();
  });

  it("accepts a diff of exactly 50 KB", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "x".repeat(50_000), stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Update notes");
    expect(await createCommit("/repo", "key")).toBeNull();
  });
});
