import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
}));

import { requestUrl, type RequestUrlParam } from "obsidian";
import { generateCommitMessage } from "../ai";
import { DEFAULT_COMMIT_STYLE } from "../settings";

const requestUrlMock = vi.mocked(requestUrl);

function mockResponse(status: number, text: string) {
  requestUrlMock.mockResolvedValueOnce({
    status,
    json: { content: [{ text }] },
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("generateCommitMessage", () => {
  it("returns trimmed text from a successful response", async () => {
    mockResponse(200, "  Add meeting notes  ");
    expect(await generateCommitMessage("diff", "key", "style")).toBe("Add meeting notes");
  });

  it("sends the configured commit style in the request body", async () => {
    mockResponse(200, "Add meeting notes");
    await generateCommitMessage("diff", "key", "Português Brasileiro, presente do indicativo");
    const body = JSON.parse((requestUrlMock.mock.calls[0][0] as RequestUrlParam).body as string);
    expect(body.system).toContain("Português Brasileiro, presente do indicativo");
  });

  it("falls back to the default style when commitStyle is empty", async () => {
    mockResponse(200, "Add meeting notes");
    await generateCommitMessage("diff", "key", "");
    const body = JSON.parse((requestUrlMock.mock.calls[0][0] as RequestUrlParam).body as string);
    expect(body.system).toContain(DEFAULT_COMMIT_STYLE);
  });

  it("throws on HTTP 400", async () => {
    mockResponse(400, "");
    await expect(generateCommitMessage("diff", "key", "style")).rejects.toThrow("HTTP 400");
  });

  it("throws on HTTP 401", async () => {
    mockResponse(401, "");
    await expect(generateCommitMessage("diff", "key", "style")).rejects.toThrow("HTTP 401");
  });

  it("throws on HTTP 500", async () => {
    mockResponse(500, "");
    await expect(generateCommitMessage("diff", "key", "style")).rejects.toThrow("HTTP 500");
  });

  it("throws when requestUrl rejects", async () => {
    requestUrlMock.mockRejectedValueOnce(new Error("network error"));
    await expect(generateCommitMessage("diff", "key", "style")).rejects.toThrow(
      "network error"
    );
  });

  it("rejects with timeout error when the clock fires", async () => {
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void) => { fn(); return 0; },
    });
    requestUrlMock.mockImplementationOnce(() => new Promise(() => {}) as never);
    await expect(generateCommitMessage("diff", "key", "style")).rejects.toThrow("timeout");
  });
});
