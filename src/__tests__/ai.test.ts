import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("obsidian", () => ({
  requestUrl: vi.fn(),
}));

import { requestUrl, type RequestUrlParam } from "obsidian";
import { generateCommitMessage } from "../ai";
import type { AiConfig } from "../settings";

const requestUrlMock = vi.mocked(requestUrl);

const ai = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  anthropicApiKey: "key",
  prompt: "Write in English (US), imperative mode.",
  model: "claude-haiku-4-5",
  effort: "low",
  ...overrides,
});

function mockResponse(status: number, content: unknown) {
  requestUrlMock.mockResolvedValueOnce({ status, json: { content } } as any);
}

function mockText(status: number, text: string) {
  mockResponse(status, [{ type: "text", text }]);
}

function sentBody() {
  return JSON.parse((requestUrlMock.mock.calls[0][0] as RequestUrlParam).body as string);
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
    mockText(200, "  Add meeting notes  ");
    expect(await generateCommitMessage("diff", ai())).toBe("Add meeting notes");
  });

  it("sends the configured prompt in the request body", async () => {
    mockText(200, "Add meeting notes");
    await generateCommitMessage("diff", ai({ prompt: "Escreva em português." }));
    expect(sentBody().system).toContain("Escreva em português.");
  });

  it("puts the output contract before the user prompt", async () => {
    mockText(200, "Add meeting notes");
    await generateCommitMessage("diff", ai({ prompt: "PROMPT_MARKER" }));
    const system = sentBody().system as string;
    expect(system.indexOf("PROMPT_MARKER")).toBeGreaterThan(0);
    expect(system).toMatch(/^Your entire response is the commit message/);
  });

  it("sends max_tokens of 8192 and never a temperature", async () => {
    mockText(200, "Add meeting notes");
    await generateCommitMessage("diff", ai());
    const body = sentBody();
    expect(body.max_tokens).toBe(8192);
    expect(body).not.toHaveProperty("temperature");
  });

  it("omits output_config and thinking on Haiku 4.5", async () => {
    mockText(200, "Add meeting notes");
    await generateCommitMessage("diff", ai({ model: "claude-haiku-4-5" }));
    const body = sentBody();
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body).not.toHaveProperty("output_config");
    expect(body).not.toHaveProperty("thinking");
  });

  it("sends adaptive thinking and the configured effort on Sonnet 5", async () => {
    mockText(200, "Add meeting notes");
    await generateCommitMessage("diff", ai({ model: "claude-sonnet-5", effort: "high" }));
    const body = sentBody();
    expect(body.model).toBe("claude-sonnet-5");
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "high" });
  });

  it("sends adaptive thinking and the configured effort on Opus 5", async () => {
    mockText(200, "Add meeting notes");
    await generateCommitMessage("diff", ai({ model: "claude-opus-5", effort: "max" }));
    const body = sentBody();
    expect(body.model).toBe("claude-opus-5");
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "max" });
  });

  it("extracts the message when a thinking block precedes the text block", async () => {
    mockResponse(200, [
      { type: "thinking", thinking: "" },
      { type: "text", text: "Add meeting notes" },
    ]);
    expect(await generateCommitMessage("diff", ai({ model: "claude-opus-5" }))).toBe(
      "Add meeting notes"
    );
  });

  it("throws when the response carries no text block", async () => {
    mockResponse(200, [{ type: "thinking", thinking: "" }]);
    await expect(generateCommitMessage("diff", ai())).rejects.toThrow(
      "no text block in response"
    );
  });

  it("throws on HTTP 400", async () => {
    mockText(400, "");
    await expect(generateCommitMessage("diff", ai())).rejects.toThrow("HTTP 400");
  });

  it("throws on HTTP 401", async () => {
    mockText(401, "");
    await expect(generateCommitMessage("diff", ai())).rejects.toThrow("HTTP 401");
  });

  it("throws on HTTP 500", async () => {
    mockText(500, "");
    await expect(generateCommitMessage("diff", ai())).rejects.toThrow("HTTP 500");
  });

  it("throws when requestUrl rejects", async () => {
    requestUrlMock.mockRejectedValueOnce(new Error("network error"));
    await expect(generateCommitMessage("diff", ai())).rejects.toThrow("network error");
  });

  it("rejects with timeout error when the clock fires", async () => {
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void) => { fn(); return 0; },
    });
    requestUrlMock.mockImplementationOnce(() => new Promise(() => {}) as never);
    await expect(generateCommitMessage("diff", ai())).rejects.toThrow("timeout");
  });
});
