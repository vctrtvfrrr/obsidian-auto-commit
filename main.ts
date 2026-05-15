import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  App,
  FileSystemAdapter,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import {
  type AutoCommitSettings,
  DEFAULT_SETTINGS,
  deobfuscate,
  obfuscate,
} from "./src/settings";
import { TOOLTIPS, type TooltipKey } from "./src/tooltips";
import { checkRepoGuards } from "./src/guards";
import { createCommit } from "./src/commit";
import { syncRemote } from "./src/remote";

const execFileP = promisify(execFile);

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
      const { stdout } = await execFileP("git", ["status", "--porcelain"], { cwd });
      if (stdout.trim()) this.runCommit();
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
    if (this.timer !== null) window.clearTimeout(this.timer);
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

    const guardResult = await checkRepoGuards(cwd);
    if (guardResult !== null) {
      this.setStatusFailed(guardResult);
      return;
    }

    const commitResult = await createCommit(cwd, this.settings.anthropicApiKey);
    if (commitResult === "noChanges") {
      this.setStatusNoChanges();
      return;
    }
    if (commitResult !== null) {
      this.setStatusFailed(commitResult);
      return;
    }

    if (!this.settings.pushEnabled) {
      this.setStatusOk(false);
      return;
    }

    const remoteResult = await syncRemote(
      cwd,
      this.settings.remote,
      this.settings.branch
    );
    if (remoteResult !== null) {
      this.setStatusFailed(remoteResult);
    } else {
      this.setStatusOk(true);
    }
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
