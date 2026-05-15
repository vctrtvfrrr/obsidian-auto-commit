import { describe, it, expect } from "vitest";
import { obfuscate, deobfuscate, DEFAULT_SETTINGS } from "../settings";
import type { AutoCommitSettings } from "../settings";

describe("obfuscate / deobfuscate", () => {
  it("round-trips DEFAULT_SETTINGS", () => {
    expect(deobfuscate(obfuscate(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips custom settings", () => {
    const cfg: AutoCommitSettings = {
      inactivityMinutes: 5,
      branch: "main",
      remote: "upstream",
      pushEnabled: false,
      anthropicApiKey: "sk-test-key",
    };
    expect(deobfuscate(obfuscate(cfg))).toEqual(cfg);
  });

  it("obfuscate output differs from plain JSON", () => {
    const encoded = obfuscate(DEFAULT_SETTINGS);
    expect(encoded).not.toContain("inactivityMinutes");
  });

  it("deobfuscate is the exact inverse of obfuscate", () => {
    const cfg: AutoCommitSettings = {
      inactivityMinutes: 30,
      branch: "",
      remote: "origin",
      pushEnabled: true,
      anthropicApiKey: "",
    };
    const encoded = obfuscate(cfg);
    const decoded = deobfuscate(encoded);
    expect(decoded.inactivityMinutes).toBe(30);
    expect(decoded.branch).toBe("");
    expect(decoded.remote).toBe("origin");
    expect(decoded.pushEnabled).toBe(true);
    expect(decoded.anthropicApiKey).toBe("");
  });
});
