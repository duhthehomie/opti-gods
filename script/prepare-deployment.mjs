import { execFileSync } from "node:child_process";
import { readdir, rm, stat } from "node:fs/promises";

const GIB = 1024 ** 3;
const SAFE_LIMIT_BYTES = 7 * GIB;
const phase = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!["before", "after"].includes(phase)) {
  console.error("Usage: node script/prepare-deployment.mjs <before|after> [--dry-run]");
  process.exit(2);
}

if (process.env.OPTI_DEPLOY_CLEANUP !== "1") {
  console.error(
    "Refusing to clean this workspace. OPTI_DEPLOY_CLEANUP=1 is required and is set only by the Replit publish command.",
  );
  process.exit(2);
}

const beforeBuildRemovals = [
  ".git",
  ".local",
  ".cache",
  ".canvas",
  ".agents",
  "attached_assets",
  "downloads",
  "releases",
  "screenshots",
  "src-tauri/target",
  "dist",
];

const afterBuildRemovals = [".cache", "src-tauri/target"];

async function removePath(path) {
  if (dryRun) {
    console.log(`[deployment-cleanup] would remove ${path}`);
    return;
  }
  await rm(path, { recursive: true, force: true });
  console.log(`[deployment-cleanup] removed ${path}`);
}

function workspaceBytes() {
  const output = execFileSync("du", ["-sk", "."], { encoding: "utf8" });
  const kib = Number.parseInt(output.trim().split(/\s+/)[0], 10);
  if (!Number.isFinite(kib)) throw new Error(`Could not parse workspace size: ${output}`);
  return kib * 1024;
}

async function topLevelSizes() {
  const entries = await readdir(".", { withFileTypes: true });
  const rows = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const output = execFileSync("du", ["-sk", entry.name], { encoding: "utf8" });
      const kib = Number.parseInt(output.trim().split(/\s+/)[0], 10);
      rows.push({ name: entry.name, bytes: kib * 1024 });
    } catch {
      const info = await stat(entry.name);
      rows.push({ name: entry.name, bytes: info.size });
    }
  }
  return rows.sort((a, b) => b.bytes - a.bytes).slice(0, 12);
}

const removals = phase === "before" ? beforeBuildRemovals : afterBuildRemovals;
for (const path of removals) await removePath(path);

if (dryRun) {
  console.log(`[deployment-cleanup] ${phase} dry run complete; no files changed`);
  process.exit(0);
}

const bytes = workspaceBytes();
console.log(`[deployment-cleanup] ${phase} workspace size: ${(bytes / GIB).toFixed(2)} GiB`);

if (phase === "after" && bytes > SAFE_LIMIT_BYTES) {
  console.error(
    `[deployment-cleanup] publish snapshot is ${(bytes / GIB).toFixed(2)} GiB, above the safe 7.00 GiB limit.`,
  );
  for (const row of await topLevelSizes()) {
    console.error(`  ${(row.bytes / GIB).toFixed(2)} GiB  ${row.name}`);
  }
  process.exit(1);
}
