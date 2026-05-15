import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  App,
  FileSystemAdapter,
  Notice,
  Plugin,
  PluginSettingTab,
  RequestUrlParam,
  Setting,
  requestUrl,
} from "obsidian";

const execFileP = promisify(execFile);

// ---------- Settings ----------

interface AutoCommitSettings {
  inactivityMinutes: number;
  branch: string;
  remote: string;
  pushEnabled: boolean;
  anthropicApiKey: string;
}

const DEFAULT_SETTINGS: AutoCommitSettings = {
  inactivityMinutes: 15,
  branch: "",
  remote: "origin",
  pushEnabled: true,
  anthropicApiKey: "",
};

// ---------- Obfuscation ----------

const rev = (s: string) => s.split("").reverse().join("");
const obfuscate = (cfg: AutoCommitSettings): string =>
  rev(btoa(JSON.stringify(cfg)));
const deobfuscate = (s: string): AutoCommitSettings =>
  JSON.parse(atob(rev(s)));

// ---------- Tooltip catalog ----------

const TOOLTIPS = {
  idle: "Ready. Sync runs after the inactivity interval or via the Run now command.",
  syncing: "Syncing the repository…",
  noChanges: "No pending changes to commit.",
  okWithPush: "Commit created and changes pushed to the remote successfully.",
  okNoPush:
    "Commit created in the local repository only. Auto-push is disabled in settings.",
  failedUnexpected: "An unexpected error occurred. See the console for details.",
  failedMerge:
    "A merge is in progress. Complete or abort it manually before auto-sync.",
  failedCherryPick:
    "A cherry-pick is in progress. Complete or abort it manually before auto-sync.",
  failedRevert:
    "A revert is in progress. Complete or abort it manually before auto-sync.",
  failedBisect: "A bisect is in progress. Finish or abort it before auto-sync.",
  failedRebase:
    "A rebase is in progress. Complete or abort it manually before auto-sync.",
  failedDetached:
    "The repository is in detached HEAD state. Check out a branch before auto-sync.",
  failedDiffTooLarge:
    "The diff exceeded the 50 KB limit. Review and commit manually.",
  failedAi:
    "Could not generate the commit message with AI. Changes remain staged.",
  failedRebaseConflict:
    "Conflict while updating from remote; rebase was aborted. Resolve manually.",
  failedPush:
    "Push failed after local commit. Check credentials, network, and remote permissions.",
  failedGitStatus:
    "Could not check repository status with Git. See the console for details.",
} as const;

type TooltipKey = keyof typeof TOOLTIPS;

// ---------- Plugin ----------

export default class AutoCommitPlugin extends Plugin {
  settings: AutoCommitSettings = { ...DEFAULT_SETTINGS };
  private timer: number | null = null;
  private isRunning = false;
  private statusBarItem: HTMLElement | null = null;

  private formatTimeHm(): string {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  private updateStatus(label: string, tooltipKey: TooltipKey): void {
    if (!this.statusBarItem) return;
    this.statusBarItem.setText(label);
    this.statusBarItem.title = TOOLTIPS[tooltipKey];
  }

  private setStatusIdle(): void {
    this.updateStatus("Auto-commit: idle", "idle");
  }

  private setStatusSyncing(): void {
    this.updateStatus("Auto-commit: syncing...", "syncing");
  }

  private setStatusOk(pushed: boolean): void {
    this.updateStatus(
      `Auto-commit: OK ${this.formatTimeHm()}`,
      pushed ? "okWithPush" : "okNoPush"
    );
  }

  private setStatusFailed(tooltipKey: TooltipKey = "failedUnexpected"): void {
    this.updateStatus(`Auto-commit: failed ${this.formatTimeHm()}`, tooltipKey);
  }

  private setStatusNoChanges(): void {
    this.updateStatus(`Auto-commit: no changes ${this.formatTimeHm()}`, "noChanges");
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AutoCommitSettingTab(this.app, this));

    // Self-check: git must be in PATH
    try {
      await execFileP("git", ["--version"]);
    } catch {
      new Notice(
        "Auto-commit: comando 'git' não encontrado no PATH. Verifique a instalação.",
        0
      );
      return;
    }

    this.statusBarItem = this.addStatusBarItem();
    this.setStatusIdle();

    // Register vault change listeners
    this.registerEvent(this.app.vault.on("modify", () => this.resetTimer()));
    this.registerEvent(this.app.vault.on("create", () => this.resetTimer()));
    this.registerEvent(this.app.vault.on("delete", () => this.resetTimer()));
    this.registerEvent(this.app.vault.on("rename", () => this.resetTimer()));

    this.addCommand({
      id: "run-now",
      name: "Run now",
      callback: () => this.runCommit(),
    });

    // Commit any orphaned changes from previous session
    const cwd = this.getVaultPath();
    try {
      const { stdout } = await execFileP(
        "git",
        ["status", "--porcelain"],
        { cwd }
      );
      if (stdout.trim()) {
        this.runCommit();
      }
    } catch {
      // If git status fails here, the commit attempt will handle it
    }
  }

  onunload() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private getVaultPath(): string {
    return (this.app.vault.adapter as FileSystemAdapter).getBasePath();
  }

  private resetTimer() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(
      () => this.runCommit(),
      this.settings.inactivityMinutes * 60_000
    );
  }

  private async runCommit() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setStatusSyncing();
    try {
      await this.doCommit();
    } catch (err) {
      this.setStatusFailed();
      console.error("Auto-commit: unexpected error:", err);
    } finally {
      this.isRunning = false;
    }
  }

  private async doCommit() {
    const cwd = this.getVaultPath();

    // Guard: special repo state
    const specialStateGuards: [string, TooltipKey][] = [
      [".git/MERGE_HEAD", "failedMerge"],
      [".git/CHERRY_PICK_HEAD", "failedCherryPick"],
      [".git/REVERT_HEAD", "failedRevert"],
      [".git/BISECT_LOG", "failedBisect"],
    ];
    for (const [f, tooltipKey] of specialStateGuards) {
      if (existsSync(join(cwd, f))) {
        console.info(`Auto-commit: skipped — repo in special state (${f})`);
        this.setStatusFailed(tooltipKey);
        return;
      }
    }
    if (
      existsSync(join(cwd, ".git/rebase-merge")) ||
      existsSync(join(cwd, ".git/rebase-apply"))
    ) {
      console.info("Auto-commit: skipped — rebase in progress");
      this.setStatusFailed("failedRebase");
      return;
    }

    // Guard: detached HEAD
    try {
      await execFileP("git", ["symbolic-ref", "-q", "HEAD"], { cwd });
    } catch {
      console.info("Auto-commit: skipped — detached HEAD");
      this.setStatusFailed("failedDetached");
      return;
    }

    // Guard: no changes
    let statusOut: string;
    try {
      const { stdout } = await execFileP(
        "git",
        ["status", "--porcelain"],
        { cwd }
      );
      statusOut = stdout;
    } catch {
      this.setStatusFailed("failedGitStatus");
      return;
    }
    if (!statusOut.trim()) {
      this.setStatusNoChanges();
      return;
    }

    // Stage everything
    await execFileP("git", ["add", "-A"], { cwd });

    // Get diff
    const { stdout: diff } = await execFileP(
      "git",
      ["diff", "--staged"],
      { cwd }
    );

    // Guard: diff too large
    if (diff.length > 50_000) {
      new Notice(
        "Auto-commit: diff > 50 KB, requer revisão manual. Resolva via terminal.",
        0
      );
      this.setStatusFailed("failedDiffTooLarge");
      return;
    }

    // Generate commit message via AI
    let message: string;
    try {
      message = await this.generateCommitMessage(diff);
    } catch (err) {
      new Notice(
        "Auto-commit: falha ao gerar mensagem (IA indisponível). Mudanças continuam pendentes.",
        0
      );
      console.error("Auto-commit: AI error:", err);
      this.setStatusFailed("failedAi");
      return;
    }

    // Commit
    await execFileP("git", ["commit", "-m", message], { cwd });

    // Push
    if (!this.settings.pushEnabled) {
      this.setStatusOk(false);
      return;
    }

    const remote = this.settings.remote;
    const effectiveBranch =
      this.settings.branch ||
      (
        await execFileP("git", ["symbolic-ref", "--short", "HEAD"], { cwd })
      ).stdout.trim();

    await execFileP("git", ["fetch", remote], { cwd });

    try {
      const { stdout: aheadCount } = await execFileP(
        "git",
        ["rev-list", `HEAD..${remote}/${effectiveBranch}`, "--count"],
        { cwd }
      );
      if (parseInt(aheadCount.trim(), 10) > 0) {
        try {
          await execFileP(
            "git",
            ["pull", "--rebase", remote, effectiveBranch],
            { cwd }
          );
        } catch {
          await execFileP("git", ["rebase", "--abort"], { cwd }).catch(
            () => {}
          );
          new Notice(
            "Auto-commit: conflito com remoto. Rebase abortado. Resolva manualmente.",
            0
          );
          this.setStatusFailed("failedRebaseConflict");
          return;
        }
      }
    } catch {
      // Remote branch may not exist yet; proceed to push
    }

    try {
      const pushArgs = this.settings.branch
        ? ["push", remote, effectiveBranch]
        : ["push", remote, "HEAD"];
      await execFileP("git", pushArgs, { cwd });
      this.setStatusOk(true);
    } catch (err) {
      new Notice(
        "Auto-commit: push falhou. Commit local feito mas não enviado. Verifique credenciais/rede.",
        0
      );
      console.error("Auto-commit: push error:", err);
      this.setStatusFailed("failedPush");
    }
  }

  private async generateCommitMessage(diff: string): Promise<string> {
    const req: RequestUrlParam = {
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.settings.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        temperature: 0.2,
        system:
          "You generate commit messages in English (US), in imperative mode, for a vault in Obsidian. Rules:\n" +
          "- A single line of up to 72 characters.\n" +
          "- No conventional prefixes (no \"feat:\", \"docs:\", etc.).\n" +
          "- Describe what changed concretely, citing files or areas when useful.\n" +
          "- If there are many heterogeneous changes, summarize the dominant theme.\n" +
          "- Any changes to the `.obsidian/` directory should not be detailed, only mentioned.\n" +
          "- Do not use quotation marks, backticks, or special characters. Just the message, without prefixes " +
          "like \"Message:\" or explanatory text.",
        messages: [{ role: "user", content: diff }],
      }),
      throw: false,
    };

    const timeout = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("timeout")), 60_000)
    );

    const res = await Promise.race([requestUrl(req), timeout]);

    if (res.status >= 400) {
      throw new Error(`HTTP ${res.status}`);
    }

    return (res.json.content[0].text as string).trim();
  }

  async loadSettings() {
    const raw = await this.loadData();
    if (!raw) {
      this.settings = { ...DEFAULT_SETTINGS };
      return;
    }
    if (raw.d) {
      try {
        this.settings = { ...DEFAULT_SETTINGS, ...deobfuscate(raw.d) };
        return;
      } catch {
        this.settings = { ...DEFAULT_SETTINGS };
        return;
      }
    }
    // Migration: raw fields from old format
    this.settings = { ...DEFAULT_SETTINGS, ...raw };
    await this.saveSettings();
  }

  async saveSettings() {
    await this.saveData({ d: obfuscate(this.settings) });
  }
}

// ---------- Settings Tab ----------

class AutoCommitSettingTab extends PluginSettingTab {
  plugin: AutoCommitPlugin;

  constructor(app: App, plugin: AutoCommitPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Inactivity interval (minutes)")
      .setDesc("Commit after this many minutes without changes.")
      .addText((text) =>
        text
          .setPlaceholder("15")
          .setValue(String(this.plugin.settings.inactivityMinutes))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1) return;
            this.plugin.settings.inactivityMinutes = num;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Branch")
      .setDesc("Branch to push to. Leave empty to use the current branch.")
      .addText((text) =>
        text
          .setPlaceholder("(current branch)")
          .setValue(this.plugin.settings.branch)
          .onChange(async (value) => {
            this.plugin.settings.branch = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remote")
      .setDesc("Git remote name.")
      .addText((text) =>
        text
          .setPlaceholder("origin")
          .setValue(this.plugin.settings.remote)
          .onChange(async (value) => {
            this.plugin.settings.remote = value.trim() || "origin";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Push after commit")
      .setDesc("Automatically push after each commit.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.pushEnabled)
          .onChange(async (value) => {
            this.plugin.settings.pushEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Anthropic API key")
      .setDesc("Used to generate commit messages via Claude.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });
  }
}
