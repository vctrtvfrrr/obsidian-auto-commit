export interface AutoCommitSettings {
  inactivityMinutes: number;
  fetchIntervalMinutes: number;
  branch: string;
  remote: string;
  pushEnabled: boolean;
  anthropicApiKey: string;
}

export const DEFAULT_SETTINGS: AutoCommitSettings = {
  inactivityMinutes: 15,
  fetchIntervalMinutes: 5,
  branch: "",
  remote: "origin",
  pushEnabled: true,
  anthropicApiKey: "",
};

const rev = (s: string) => s.split("").reverse().join("");
export const obfuscate = (cfg: AutoCommitSettings): string =>
  rev(btoa(JSON.stringify(cfg)));
export const deobfuscate = (s: string): AutoCommitSettings =>
  JSON.parse(atob(rev(s)));
