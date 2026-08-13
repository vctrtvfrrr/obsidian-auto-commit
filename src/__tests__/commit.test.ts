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
    expect(await createCommit("/repo", "key", "style")).toEqual({ ok: false, reason: "failedGitStatus" });
  });

  it("returns noChanges when status output is empty", async () => {
    execFileAsyncMock.mockResolvedValueOnce({ stdout: "", stderr: "" });
    expect(await createCommit("/repo", "key", "style")).toEqual({ ok: "noChanges" });
  });

  it("returns noChanges when status output is only whitespace", async () => {
    execFileAsyncMock.mockResolvedValueOnce({ stdout: "   \n", stderr: "" });
    expect(await createCommit("/repo", "key", "style")).toEqual({ ok: "noChanges" });
  });

  it("returns failedDiffTooLarge when the payload exceeds 200 KB", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })  // status
      .mockResolvedValueOnce({ stdout: "", stderr: "" })             // add -A
      .mockResolvedValueOnce({ stdout: "x".repeat(200_001), stderr: "" }); // payload
    expect(await createCommit("/repo", "key", "style")).toEqual({ ok: false, reason: "failedDiffTooLarge" });
  });

  it("returns failedAi when generateCommitMessage throws", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "small diff", stderr: "" });
    generateCommitMessageMock.mockRejectedValueOnce(new Error("AI down"));
    expect(await createCommit("/repo", "key", "style")).toEqual({ ok: false, reason: "failedAi" });
  });

  it("returns null on successful commit", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "small diff", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Add meeting notes");
    expect(await createCommit("/repo", "key", "style")).toBeNull();
  });

  it("accepts a payload of exactly 200 KB", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "x".repeat(200_000), stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Update notes");
    expect(await createCommit("/repo", "key", "style")).toBeNull();
  });

  it("excludes .obsidian/ from the payload sent to the AI", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "notes diff", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Update notes");

    await createCommit("/repo", "key", "style");

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      "git",
      ["diff", "--staged", "--", ":(exclude,top).obsidian/"],
      { cwd: "/repo" }
    );
    expect(generateCommitMessageMock).toHaveBeenCalledWith("notes diff", "key", "style");
  });

  it("falls back to the .obsidian/ diff when nothing else changed", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M .obsidian/workspace.json", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "obsidian diff", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Update editor settings");

    expect(await createCommit("/repo", "key", "style")).toBeNull();

    expect(execFileAsyncMock).toHaveBeenCalledWith(
      "git",
      ["diff", "--staged", "--", ".obsidian/"],
      { cwd: "/repo" }
    );
    expect(generateCommitMessageMock).toHaveBeenCalledWith("obsidian diff", "key", "style");
  });

  it("stages and commits everything, with no pathspec", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ stdout: "M notes.md", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "notes diff", stderr: "" })
      .mockResolvedValueOnce({ stdout: "", stderr: "" });
    generateCommitMessageMock.mockResolvedValueOnce("Update notes");

    await createCommit("/repo", "key", "style");

    expect(execFileAsyncMock).toHaveBeenCalledWith("git", ["add", "-A"], { cwd: "/repo" });
    expect(execFileAsyncMock).toHaveBeenCalledWith(
      "git",
      ["commit", "-m", "Update notes"],
      { cwd: "/repo" }
    );
  });
});
