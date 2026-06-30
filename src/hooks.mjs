import fs from "node:fs/promises";
import path from "node:path";
import { findGitRoot } from "./git.mjs";

export async function installHooks() {
  const root = await findGitRoot(process.cwd());
  const hooksDir = path.join(root, ".git", "hooks");
  await fs.mkdir(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, "pre-push");
  const script = `#!/bin/sh
ROOT="$(git rev-parse --show-toplevel)"
node "$ROOT/bin/merge-guard.mjs" analyze --fail-on high
`;

  await fs.writeFile(hookPath, script, "utf8");
  await fs.chmod(hookPath, 0o755);

  return {
    hookPath,
    message: `Installed pre-push hook at ${hookPath}`,
  };
}
