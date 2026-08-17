export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;

export type Effort = (typeof EFFORT_LEVELS)[number];

export type SupportedModel = {
  id: string;
  label: string;
  supportsEffort: boolean;
  supportsThinking: boolean;
};

// The Anthropic API does not accept the same parameters on every model:
// `output_config.effort` errors on Haiku 4.5, and adaptive thinking does not exist
// there either. This table is the only source of truth about that — adding a fourth
// model means editing here and nowhere else.
export const SUPPORTED_MODELS: SupportedModel[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 — fastest, cheapest",
    supportsEffort: false,
    supportsThinking: false,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5 — better instruction following",
    supportsEffort: true,
    supportsThinking: true,
  },
  {
    id: "claude-opus-5",
    label: "Claude Opus 5 — highest quality, most expensive",
    supportsEffort: true,
    supportsThinking: true,
  },
];

export const DEFAULT_MODEL = SUPPORTED_MODELS[0].id;
export const DEFAULT_EFFORT: Effort = "low";

export const findModel = (id: string): SupportedModel | undefined =>
  SUPPORTED_MODELS.find((m) => m.id === id);

export interface AutoCommitSettings {
  inactivityMinutes: number;
  fetchIntervalMinutes: number;
  branch: string;
  remote: string;
  pushEnabled: boolean;
  anthropicApiKey: string;
  model: string;
  effort: Effort;
  prompt: string;
}

// Everything the AI path needs and nothing else — passing the whole settings object
// would hand `ai.ts` and `commit.ts` access to push, branch and remote.
export type AiConfig = Pick<
  AutoCommitSettings,
  "anthropicApiKey" | "prompt" | "model" | "effort"
>;

export const DEFAULT_SETTINGS: AutoCommitSettings = {
  inactivityMinutes: 15,
  fetchIntervalMinutes: 5,
  branch: "",
  remote: "origin",
  pushEnabled: true,
  anthropicApiKey: "",
  model: DEFAULT_MODEL,
  effort: DEFAULT_EFFORT,
  prompt: "",
};

// Placeholder for the prompt field only. Never written to disk and never used as a
// fallback — falling back to it would defeat the field being mandatory.
export const DEFAULT_PROMPT =
  "Write the commit message in English (US), imperative mode.\n" +
  "- No line anywhere in the message may exceed 80 characters.\n" +
  "- A subject line. Aim for about 60 characters and never write up to the 80 " +
  "character limit — a subject that fills the line is too long. When the detail does " +
  "not fit, move it into the body instead of extending the subject.\n" +
  "- An optional body, separated from the subject by a blank line, hard wrapped at 80 " +
  "columns, with an unlimited number of lines. Omit the body when the change is trivial.\n" +
  '- No conventional commit prefixes (no "feat:", "docs:", etc.).\n' +
  "- Describe what changed concretely, citing files or areas when useful. Backticks " +
  "around file and directory names are allowed.\n" +
  "- If there are many heterogeneous changes, summarize the dominant theme.\n" +
  "- When the diff contains only `.obsidian/` changes, describe them coarsely (theme, " +
  "hotkeys, plugin configuration) in a subject line only, with no body.";

// `data.json` is hand-editable and a model may leave the list in a future version.
// An unknown model or effort degrades to the default instead of failing every commit.
export function normalizeSettings(cfg: AutoCommitSettings): AutoCommitSettings {
  const normalized = { ...cfg };

  if (!findModel(normalized.model)) {
    console.warn(
      `Auto-commit: unknown model "${normalized.model}", falling back to ${DEFAULT_MODEL}`
    );
    normalized.model = DEFAULT_MODEL;
  }

  if (!EFFORT_LEVELS.includes(normalized.effort)) {
    console.warn(
      `Auto-commit: unknown effort "${normalized.effort}", falling back to ${DEFAULT_EFFORT}`
    );
    normalized.effort = DEFAULT_EFFORT;
  }

  return normalized;
}

const rev = (s: string) => s.split("").reverse().join("");

// btoa/atob only handle Latin-1, and the prompt accepts any script (日本語, …).
const toBase64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));

// Data written before the UTF-8 encoding was introduced holds one Latin-1 byte per
// character. Decoding it as UTF-8 would silently mangle accented branch and remote
// names, so fall back to the exact inverse of the old encoding when UTF-8 rejects it.
const fromBase64 = (s: string) => {
  const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return String.fromCharCode(...bytes);
  }
};

export const obfuscate = (cfg: AutoCommitSettings): string =>
  rev(toBase64(JSON.stringify(cfg)));
export const deobfuscate = (s: string): AutoCommitSettings =>
  JSON.parse(fromBase64(rev(s)));
