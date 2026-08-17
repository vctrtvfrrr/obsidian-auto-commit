import { vi, describe, it, expect } from "vitest";
import {
  obfuscate,
  deobfuscate,
  normalizeSettings,
  DEFAULT_SETTINGS,
  DEFAULT_MODEL,
  DEFAULT_EFFORT,
} from "../settings";
import type { AutoCommitSettings } from "../settings";

describe("obfuscate / deobfuscate", () => {
  it("round-trips DEFAULT_SETTINGS", () => {
    expect(deobfuscate(obfuscate(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips custom settings", () => {
    const cfg: AutoCommitSettings = {
      inactivityMinutes: 5,
      fetchIntervalMinutes: 10,
      branch: "main",
      remote: "upstream",
      pushEnabled: false,
      anthropicApiKey: "sk-test-key",
      model: "claude-opus-5",
      effort: "xhigh",
      prompt: "日本語で書いてください。",
    };
    expect(deobfuscate(obfuscate(cfg))).toEqual(cfg);
  });

  it("round-trips a multi-line prompt", () => {
    const cfg: AutoCommitSettings = {
      ...DEFAULT_SETTINGS,
      prompt: "Linha um\n\n- Item com acento: ção\n- Outro item\n",
    };
    expect(deobfuscate(obfuscate(cfg)).prompt).toBe(cfg.prompt);
  });

  it("reads legacy Latin-1 data without mangling accented values", () => {
    const cfg = { ...DEFAULT_SETTINGS, branch: "produção", remote: "origín" };
    const legacyRev = (s: string) => s.split("").reverse().join("");
    const legacy = legacyRev(btoa(JSON.stringify(cfg)));
    expect(deobfuscate(legacy)).toEqual(cfg);
  });

  it("obfuscate output differs from plain JSON", () => {
    const encoded = obfuscate(DEFAULT_SETTINGS);
    expect(encoded).not.toContain("inactivityMinutes");
  });

  it("deobfuscate is the exact inverse of obfuscate", () => {
    const cfg: AutoCommitSettings = {
      inactivityMinutes: 30,
      fetchIntervalMinutes: 5,
      branch: "",
      remote: "origin",
      pushEnabled: true,
      anthropicApiKey: "",
      model: "claude-sonnet-5",
      effort: "medium",
      prompt: "Write in English (US), imperative mode.",
    };
    const decoded = deobfuscate(obfuscate(cfg));
    expect(decoded.inactivityMinutes).toBe(30);
    expect(decoded.fetchIntervalMinutes).toBe(5);
    expect(decoded.branch).toBe("");
    expect(decoded.remote).toBe("origin");
    expect(decoded.pushEnabled).toBe(true);
    expect(decoded.anthropicApiKey).toBe("");
    expect(decoded.model).toBe("claude-sonnet-5");
    expect(decoded.effort).toBe("medium");
  });
});

describe("DEFAULT_SETTINGS", () => {
  // The empty default is what makes every install — new or upgraded — start blocked
  // until the user writes a prompt.
  it("ships an empty prompt", () => {
    expect(DEFAULT_SETTINGS.prompt).toBe("");
  });

  it("defaults to the cheapest model and the lowest effort", () => {
    expect(DEFAULT_SETTINGS.model).toBe("claude-haiku-4-5");
    expect(DEFAULT_SETTINGS.effort).toBe("low");
  });
});

describe("normalizeSettings", () => {
  it("keeps valid values untouched", () => {
    const cfg: AutoCommitSettings = {
      ...DEFAULT_SETTINGS,
      model: "claude-opus-5",
      effort: "xhigh",
      prompt: "anything",
    };
    expect(normalizeSettings(cfg)).toEqual(cfg);
  });

  it("falls back to the default model when the model is unknown", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = { ...DEFAULT_SETTINGS, model: "gpt-9" };
    expect(normalizeSettings(cfg).model).toBe(DEFAULT_MODEL);
    expect(console.warn).toHaveBeenCalled();
    vi.mocked(console.warn).mockRestore();
  });

  it("falls back to the default effort when the effort is unknown", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = { ...DEFAULT_SETTINGS, effort: "turbo" as never };
    expect(normalizeSettings(cfg).effort).toBe(DEFAULT_EFFORT);
    expect(console.warn).toHaveBeenCalled();
    vi.mocked(console.warn).mockRestore();
  });

  it("does not mutate its input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = { ...DEFAULT_SETTINGS, model: "gpt-9" };
    normalizeSettings(cfg);
    expect(cfg.model).toBe("gpt-9");
    vi.mocked(console.warn).mockRestore();
  });
});
