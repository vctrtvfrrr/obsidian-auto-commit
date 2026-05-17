// Wraps Node.js built-ins behind plain function calls so they are:
//   1. Lazy — only invoked after the Platform.isMobile guard passes
//   2. Compatible — require() works in Electron renderer; await import() does not
//   3. Mockable — tests mock this module via vi.mock("../node-apis")

export type ExecResult = { stdout: string; stderr: string };

export function execFileAsync(
  file: string,
  args: string[],
  options?: { cwd?: string }
): Promise<ExecResult> {
  const { execFile } = require("node:child_process") as typeof import("node:child_process");
  const { promisify } = require("node:util") as typeof import("node:util");
  return promisify(execFile)(file, args, options) as Promise<ExecResult>;
}

export function fsExistsSync(path: string): boolean {
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  return existsSync(path);
}

export function pathJoin(...parts: string[]): string {
  const { join } = require("node:path") as typeof import("node:path");
  return join(...parts);
}
