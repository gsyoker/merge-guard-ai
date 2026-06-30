import fs from "node:fs/promises";
import path from "node:path";

const BACKUP_ROOT = ".merge-guard/backups";

export async function createBackup(root, files) {
  const sessionId = makeSessionId();
  const backupDir = path.join(root, BACKUP_ROOT, sessionId);
  const manifest = {
    schemaVersion: "0.1",
    sessionId,
    createdAt: new Date().toISOString(),
    files: [],
  };

  await fs.mkdir(backupDir, { recursive: true });

  for (const file of files) {
    const backupPath = path.join(backupDir, file.relativePath);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, file.source, "utf8");
    manifest.files.push({
      path: file.relativePath,
      backupPath: path.relative(root, backupPath),
    });
  }

  await fs.writeFile(
    path.join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return {
    sessionId,
    path: path.relative(root, backupDir),
    files: manifest.files.map((file) => file.path),
  };
}

export async function rollbackBackup(root, sessionId = "latest") {
  const backupRoot = path.join(root, BACKUP_ROOT);
  const resolvedSessionId = sessionId === "latest"
    ? await findLatestSessionId(backupRoot)
    : sessionId;

  if (!resolvedSessionId) {
    throw new Error("No Merge Guard backup sessions found.");
  }

  const backupDir = path.join(backupRoot, resolvedSessionId);
  const manifestPath = path.join(backupDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const restored = [];

  for (const file of manifest.files || []) {
    const backupPath = path.join(root, file.backupPath);
    const targetPath = path.join(root, file.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(backupPath, targetPath);
    restored.push(file.path);
  }

  return {
    sessionId: resolvedSessionId,
    restored,
  };
}

async function findLatestSessionId(backupRoot) {
  let entries = [];
  try {
    entries = await fs.readdir(backupRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1) || "";
}

function makeSessionId() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
