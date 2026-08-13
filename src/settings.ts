export interface AutoCommitSettings {
  inactivityMinutes: number;
  fetchIntervalMinutes: number;
  branch: string;
  remote: string;
  pushEnabled: boolean;
  anthropicApiKey: string;
  commitStyle: string;
}

export const DEFAULT_COMMIT_STYLE = "English (US), imperative mode";

export const DEFAULT_SETTINGS: AutoCommitSettings = {
  inactivityMinutes: 15,
  fetchIntervalMinutes: 5,
  branch: "",
  remote: "origin",
  pushEnabled: true,
  anthropicApiKey: "",
  commitStyle: DEFAULT_COMMIT_STYLE,
};

const rev = (s: string) => s.split("").reverse().join("");

// btoa/atob only handle Latin-1, and commitStyle accepts any script (日本語, …).
const toBase64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const fromBase64 = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

export const obfuscate = (cfg: AutoCommitSettings): string =>
  rev(toBase64(JSON.stringify(cfg)));
export const deobfuscate = (s: string): AutoCommitSettings =>
  JSON.parse(fromBase64(rev(s)));
