"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => AutoCommitPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var DEFAULT_SETTINGS = {
  inactivityMinutes: 15,
  fetchIntervalMinutes: 5,
  branch: "",
  remote: "origin",
  pushEnabled: true,
  anthropicApiKey: ""
};
var rev = (s) => s.split("").reverse().join("");
var obfuscate = (cfg) => rev(btoa(JSON.stringify(cfg)));
var deobfuscate = (s) => JSON.parse(atob(rev(s)));

// src/tooltips.ts
var TOOLTIPS = {
  idle: "Ready. Sync runs after the inactivity interval or via the Run now command.",
  syncing: "Syncing the repository\u2026",
  noChanges: "No pending changes to commit.",
  okWithPush: "Commit created and changes pushed to the remote successfully.",
  okNoPush: "Commit created in the local repository only. Auto-push is disabled in settings.",
  failedUnexpected: "An unexpected error occurred. See the console for details.",
  failedMerge: "A merge is in progress. Complete or abort it manually before auto-sync.",
  failedCherryPick: "A cherry-pick is in progress. Complete or abort it manually before auto-sync.",
  failedRevert: "A revert is in progress. Complete or abort it manually before auto-sync.",
  failedBisect: "A bisect is in progress. Finish or abort it before auto-sync.",
  failedRebase: "A rebase is in progress. Complete or abort it manually before auto-sync.",
  failedDetached: "The repository is in detached HEAD state. Check out a branch before auto-sync.",
  failedDiffTooLarge: "The diff exceeded the 50 KB limit. Review and commit manually.",
  failedAi: "Could not generate the commit message with AI. Changes remain staged.",
  failedRebaseConflict: "Conflict while updating from remote; rebase was aborted. Resolve manually.",
  failedPush: "Push failed after local commit. Check credentials, network, and remote permissions.",
  failedGitStatus: "Could not check repository status with Git. See the console for details.",
  pulling: "Applying remote changes\u2026",
  pulledOk: "Remote changes applied successfully.",
  failedPullConflict: "Could not apply remote changes; there are divergent local commits. Auto-sync will resolve it."
};

// src/node-apis.ts
function execFileAsync(file, args, options) {
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  return promisify(execFile)(file, args, options);
}
function fsExistsSync(path) {
  const { existsSync } = require("node:fs");
  return existsSync(path);
}
function pathJoin(...parts) {
  const { join } = require("node:path");
  return join(...parts);
}

// src/guards.ts
var SPECIAL_STATE_GUARDS = [
  [".git/MERGE_HEAD", "failedMerge"],
  [".git/CHERRY_PICK_HEAD", "failedCherryPick"],
  [".git/REVERT_HEAD", "failedRevert"],
  [".git/BISECT_LOG", "failedBisect"]
];
async function checkRepoGuards(cwd) {
  for (const [f, reason] of SPECIAL_STATE_GUARDS) {
    if (fsExistsSync(pathJoin(cwd, f))) {
      console.info(`Auto-commit: skipped \u2014 repo in special state (${f})`);
      return { ok: false, reason };
    }
  }
  if (fsExistsSync(pathJoin(cwd, ".git/rebase-merge")) || fsExistsSync(pathJoin(cwd, ".git/rebase-apply"))) {
    console.info("Auto-commit: skipped \u2014 rebase in progress");
    return { ok: false, reason: "failedRebase" };
  }
  try {
    await execFileAsync("git", ["symbolic-ref", "-q", "HEAD"], { cwd });
  } catch (e) {
    console.info("Auto-commit: skipped \u2014 detached HEAD");
    return { ok: false, reason: "failedDetached" };
  }
  console.debug("Auto-commit: guards passed");
  return null;
}

// src/commit.ts
var import_obsidian2 = require("obsidian");

// src/ai.ts
var import_obsidian = require("obsidian");
async function callAnthropicApi(prompt, apiKey) {
  const req = {
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      temperature: 0.2,
      system: 'You generate commit messages in English (US), in imperative mode, for a vault in Obsidian. Rules:\n- A single line of up to 72 characters.\n- No conventional prefixes (no "feat:", "docs:", etc.).\n- Describe what changed concretely, citing files or areas when useful.\n- If there are many heterogeneous changes, summarize the dominant theme.\n- Any changes to the `.obsidian/` directory should not be detailed, only mentioned.\n- Do not use quotation marks, backticks, or special characters. Just the message, without prefixes like "Message:" or explanatory text.',
      messages: [{ role: "user", content: prompt }]
    }),
    throw: false
  };
  const timeout = new Promise(
    (_, reject) => window.setTimeout(() => reject(new Error("timeout")), 6e4)
  );
  console.debug("Auto-commit: calling Anthropic API");
  const res = await Promise.race([(0, import_obsidian.requestUrl)(req), timeout]);
  console.debug(`Auto-commit: Anthropic API responded with status ${res.status}`);
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return res.json.content[0].text.trim();
}
async function generateCommitMessage(diff, apiKey) {
  return callAnthropicApi(diff, apiKey);
}

// src/commit.ts
async function createCommit(cwd, apiKey) {
  let statusOut;
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd });
    statusOut = stdout;
  } catch (err) {
    console.error("Auto-commit: git status failed", err);
    return { ok: false, reason: "failedGitStatus" };
  }
  if (!statusOut.trim()) return { ok: "noChanges" };
  const changedFiles = statusOut.trim().split("\n").length;
  console.info(`Auto-commit: ${changedFiles} changed file(s), staging`);
  await execFileAsync("git", ["add", "-A"], { cwd });
  const { stdout: diff } = await execFileAsync("git", ["diff", "--staged"], { cwd });
  console.debug(`Auto-commit: staged diff size = ${diff.length} bytes`);
  if (diff.length > 5e4) {
    console.warn(`Auto-commit: diff too large (${diff.length} bytes), aborting`);
    new import_obsidian2.Notice(
      "Auto-commit: diff exceeds 50 KB. Review and commit manually via terminal.",
      0
    );
    return { ok: false, reason: "failedDiffTooLarge" };
  }
  let message;
  console.debug("Auto-commit: requesting commit message from AI");
  try {
    message = await generateCommitMessage(diff, apiKey);
    console.info(`Auto-commit: AI message \u2014 "${message}"`);
  } catch (err) {
    new import_obsidian2.Notice(
      "Auto-commit: failed to generate commit message (AI unavailable). Changes remain staged.",
      0
    );
    console.error("Auto-commit: AI error:", err);
    return { ok: false, reason: "failedAi" };
  }
  await execFileAsync("git", ["commit", "-m", message], { cwd });
  console.info("Auto-commit: commit created");
  return null;
}

// src/remote.ts
var import_obsidian3 = require("obsidian");
async function syncRemote(cwd, remote, branch) {
  const effectiveBranch = branch || (await execFileAsync("git", ["symbolic-ref", "--short", "HEAD"], { cwd })).stdout.trim();
  console.debug(`Auto-commit: syncing to ${remote}/${effectiveBranch}`);
  console.debug(`Auto-commit: fetching ${remote}`);
  await execFileAsync("git", ["fetch", remote], { cwd });
  try {
    const { stdout: aheadCount } = await execFileAsync(
      "git",
      ["rev-list", `HEAD..${remote}/${effectiveBranch}`, "--count"],
      { cwd }
    );
    const count = parseInt(aheadCount.trim(), 10);
    if (count > 0) {
      console.info(`Auto-commit: remote is ${count} commit(s) ahead, rebasing`);
      try {
        await execFileAsync("git", ["pull", "--rebase", remote, effectiveBranch], { cwd });
        console.info("Auto-commit: rebase successful");
      } catch (err) {
        console.warn("Auto-commit: rebase conflict, aborting", err);
        await execFileAsync("git", ["rebase", "--abort"], { cwd }).catch(() => {
        });
        new import_obsidian3.Notice(
          "Auto-commit: conflict while updating from remote. Rebase aborted. Resolve manually.",
          0
        );
        return { ok: false, reason: "failedRebaseConflict" };
      }
    } else {
      console.debug("Auto-commit: remote is up to date, no rebase needed");
    }
  } catch (e) {
    console.debug(`Auto-commit: ${remote}/${effectiveBranch} not found, skipping rebase check`);
  }
  try {
    const pushArgs = branch ? ["push", remote, effectiveBranch] : ["push", remote, "HEAD"];
    console.debug(`Auto-commit: pushing (${pushArgs.join(" ")})`);
    await execFileAsync("git", pushArgs, { cwd });
    console.info(`Auto-commit: pushed to ${remote}/${effectiveBranch}`);
    return { ok: true, pushed: true };
  } catch (err) {
    new import_obsidian3.Notice(
      "Auto-commit: push failed. Local commit created but not pushed. Check credentials and network.",
      0
    );
    console.error("Auto-commit: push error:", err);
    return { ok: false, reason: "failedPush" };
  }
}

// src/main.ts
var AutoCommitPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.timer = null;
    this.fetchIntervalId = null;
    this.isRunning = false;
    this.statusBarItem = null;
  }
  formatTimeHm() {
    const d = /* @__PURE__ */ new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  updateStatus(label, tooltipKey) {
    if (!this.statusBarItem) return;
    this.statusBarItem.setText(label);
    this.statusBarItem.title = TOOLTIPS[tooltipKey];
  }
  setStatusIdle() {
    this.updateStatus("Auto-commit: idle", "idle");
  }
  setStatusSyncing() {
    this.updateStatus("Auto-commit: syncing...", "syncing");
  }
  setStatusOk(pushed) {
    this.updateStatus(
      `Auto-commit: OK ${this.formatTimeHm()}`,
      pushed ? "okWithPush" : "okNoPush"
    );
  }
  setStatusFailed(tooltipKey = "failedUnexpected") {
    this.updateStatus(`Auto-commit: failed ${this.formatTimeHm()}`, tooltipKey);
  }
  setStatusNoChanges() {
    this.updateStatus(`Auto-commit: no changes ${this.formatTimeHm()}`, "noChanges");
  }
  setStatusPulling() {
    this.updateStatus("Auto-commit: pulling...", "pulling");
  }
  setStatusPulledOk() {
    this.updateStatus(`Auto-commit: pulled ${this.formatTimeHm()}`, "pulledOk");
  }
  async onload() {
    if (import_obsidian4.Platform.isMobile) {
      console.info("Auto-commit: mobile platform detected, plugin disabled");
      return;
    }
    await this.loadSettings();
    console.info(
      `Auto-commit: loaded \u2014 inactivity=${this.settings.inactivityMinutes}m fetch=${this.settings.fetchIntervalMinutes}m push=${this.settings.pushEnabled} remote=${this.settings.remote} branch=${this.settings.branch || "(current)"}`
    );
    this.addSettingTab(new AutoCommitSettingTab(this.app, this));
    try {
      const { stdout } = await execFileAsync("git", ["--version"]);
      console.info(`Auto-commit: ${stdout.trim()}`);
    } catch (err) {
      console.error("Auto-commit: git not found in PATH", err);
      new import_obsidian4.Notice(
        "Auto-commit: 'git' not found in PATH. Check your Git installation.",
        0
      );
      return;
    }
    this.statusBarItem = this.addStatusBarItem();
    this.setStatusIdle();
    this.registerEvent(this.app.vault.on("modify", () => this.resetTimer()));
    this.registerEvent(this.app.vault.on("create", () => this.resetTimer()));
    this.registerEvent(this.app.vault.on("delete", () => this.resetTimer()));
    this.registerEvent(this.app.vault.on("rename", () => this.resetTimer()));
    this.addCommand({
      id: "run-now",
      name: "Run now",
      callback: () => this.runCommit()
    });
    this.startFetchInterval();
    const cwd = this.getVaultPath();
    try {
      const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd });
      if (stdout.trim()) {
        console.info("Auto-commit: orphaned changes detected on load, triggering commit");
        this.runCommit();
      }
    } catch (e) {
    }
  }
  onunload() {
    console.info("Auto-commit: unloading");
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.fetchIntervalId !== null) {
      window.clearInterval(this.fetchIntervalId);
      this.fetchIntervalId = null;
    }
  }
  getVaultPath() {
    return this.app.vault.adapter.getBasePath();
  }
  resetTimer() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    console.debug(`Auto-commit: timer reset \u2014 will commit in ${this.settings.inactivityMinutes}m`);
    this.timer = window.setTimeout(
      () => this.runCommit(),
      this.settings.inactivityMinutes * 6e4
    );
  }
  async runCommit() {
    if (this.isRunning) {
      console.debug("Auto-commit: runCommit skipped \u2014 already running");
      return;
    }
    this.isRunning = true;
    console.info("Auto-commit: commit cycle started");
    this.setStatusSyncing();
    try {
      const result = await this.doCommit();
      switch (result.ok) {
        case true:
          console.info(`Auto-commit: cycle complete \u2014 pushed=${result.pushed}`);
          this.setStatusOk(result.pushed);
          break;
        case false:
          console.warn(`Auto-commit: cycle failed \u2014 reason=${result.reason}`);
          this.setStatusFailed(result.reason);
          break;
        case "noChanges":
          console.info("Auto-commit: cycle complete \u2014 no changes");
          this.setStatusNoChanges();
          break;
      }
    } catch (err) {
      this.setStatusFailed();
      console.error("Auto-commit: unexpected error:", err);
    } finally {
      this.isRunning = false;
    }
  }
  async doCommit() {
    const cwd = this.getVaultPath();
    const guardResult = await checkRepoGuards(cwd);
    if (guardResult !== null) return guardResult;
    const commitResult = await createCommit(cwd, this.settings.anthropicApiKey);
    if (commitResult !== null) return commitResult;
    if (!this.settings.pushEnabled) {
      console.info("Auto-commit: push disabled, skipping remote sync");
      return { ok: true, pushed: false };
    }
    return syncRemote(cwd, this.settings.remote, this.settings.branch);
  }
  startFetchInterval() {
    if (this.fetchIntervalId !== null) {
      window.clearInterval(this.fetchIntervalId);
      this.fetchIntervalId = null;
    }
    if (this.settings.fetchIntervalMinutes <= 0) {
      console.info("Auto-commit: fetch interval disabled");
      return;
    }
    console.info(`Auto-commit: fetch interval set to ${this.settings.fetchIntervalMinutes}m`);
    this.fetchIntervalId = window.setInterval(
      () => this.doFetch(),
      this.settings.fetchIntervalMinutes * 6e4
    );
  }
  restartFetchInterval() {
    this.startFetchInterval();
  }
  async doFetch() {
    if (this.isRunning) {
      console.debug("Auto-commit: fetch skipped \u2014 commit cycle running");
      return;
    }
    this.isRunning = true;
    console.debug("Auto-commit: fetch cycle started");
    try {
      const cwd = this.getVaultPath();
      const guardResult = await checkRepoGuards(cwd);
      if (guardResult !== null) {
        console.debug(`Auto-commit: fetch aborted by guard \u2014 ${guardResult.reason}`);
        return;
      }
      const remote = this.settings.remote;
      const branch = this.settings.branch || (await execFileAsync("git", ["symbolic-ref", "--short", "HEAD"], { cwd })).stdout.trim();
      console.debug(`Auto-commit: fetching ${remote}`);
      try {
        await execFileAsync("git", ["fetch", remote], { cwd });
      } catch (err) {
        console.warn("Auto-commit: fetch failed", err);
        return;
      }
      let aheadCount = 0;
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["rev-list", `HEAD..${remote}/${branch}`, "--count"],
          { cwd }
        );
        aheadCount = parseInt(stdout.trim(), 10);
      } catch (e) {
        console.debug(`Auto-commit: remote branch ${remote}/${branch} not found, skipping pull`);
        return;
      }
      if (aheadCount === 0) {
        console.debug("Auto-commit: already up to date");
        return;
      }
      console.info(`Auto-commit: ${aheadCount} new commit(s) on ${remote}/${branch}`);
      const { stdout: porcelain } = await execFileAsync(
        "git",
        ["status", "--porcelain"],
        { cwd }
      );
      if (porcelain.trim()) {
        console.info("Auto-commit: skipping pull \u2014 local uncommitted changes present");
        return;
      }
      this.setStatusPulling();
      console.info(`Auto-commit: merging ${remote}/${branch} (fast-forward only)`);
      try {
        await execFileAsync("git", ["merge", "--ff-only", `${remote}/${branch}`], { cwd });
        console.info("Auto-commit: pull successful");
        this.setStatusPulledOk();
      } catch (err) {
        console.warn("Auto-commit: fast-forward merge failed", err);
        this.setStatusFailed("failedPullConflict");
      }
    } catch (err) {
      console.error("Auto-commit: unexpected error in doFetch:", err);
    } finally {
      this.isRunning = false;
    }
  }
  async loadSettings() {
    const raw = await this.loadData();
    if (!raw) {
      this.settings = { ...DEFAULT_SETTINGS };
      console.debug("Auto-commit: no saved settings, using defaults");
      return;
    }
    if (raw.d) {
      try {
        this.settings = { ...DEFAULT_SETTINGS, ...deobfuscate(raw.d) };
        return;
      } catch (e) {
        console.warn("Auto-commit: failed to deserialize settings, using defaults");
        this.settings = { ...DEFAULT_SETTINGS };
        return;
      }
    }
    console.info("Auto-commit: migrating settings from legacy format");
    this.settings = { ...DEFAULT_SETTINGS, ...raw };
    await this.saveSettings();
  }
  async saveSettings() {
    await this.saveData({ d: obfuscate(this.settings) });
  }
};
var AutoCommitSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian4.Setting(containerEl).setName("Inactivity interval (minutes)").setDesc("Commit after this many minutes without changes.").addText(
      (text) => text.setPlaceholder("15").setValue(String(this.plugin.settings.inactivityMinutes)).onChange(async (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1) return;
        this.plugin.settings.inactivityMinutes = num;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Fetch interval (minutes)").setDesc("Periodically fetch and pull remote changes. Set to 0 to disable.").addText(
      (text) => text.setPlaceholder("5").setValue(String(this.plugin.settings.fetchIntervalMinutes)).onChange(async (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0) return;
        this.plugin.settings.fetchIntervalMinutes = num;
        await this.plugin.saveSettings();
        this.plugin.restartFetchInterval();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Branch").setDesc("Branch to push to. Leave empty to use the current branch.").addText(
      (text) => text.setPlaceholder("(current branch)").setValue(this.plugin.settings.branch).onChange(async (value) => {
        this.plugin.settings.branch = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Remote").setDesc("Git remote name.").addText(
      (text) => text.setPlaceholder("origin").setValue(this.plugin.settings.remote).onChange(async (value) => {
        this.plugin.settings.remote = value.trim() || "origin";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Push after commit").setDesc("Automatically push after each commit.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.pushEnabled).onChange(async (value) => {
        this.plugin.settings.pushEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Anthropic API key").setDesc("Used to generate commit messages via Claude.").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("sk-ant-...").setValue(this.plugin.settings.anthropicApiKey).onChange(async (value) => {
        this.plugin.settings.anthropicApiKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
  }
};
