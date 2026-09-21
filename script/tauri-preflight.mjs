import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rustEntrypoint = readFileSync("src-tauri/src/lib.rs", "utf8");
const permissionManifest = readFileSync("src-tauri/permissions/app-commands.toml", "utf8");
const capability = JSON.parse(readFileSync("src-tauri/capabilities/default.json", "utf8"));
const registeredCommands = new Set(
  Array.from(rustEntrypoint.matchAll(/commands::[\w:]+::(\w+),/g), match => match[1]),
);
const allowedCommands = new Map(
  Array.from(
    permissionManifest.matchAll(
      /identifier\s*=\s*"([^"]+)"[\s\S]*?commands\.allow\s*=\s*\["([^"]+)"\]/g,
    ),
    match => [match[2], match[1]],
  ),
);
const capabilityPermissions = new Set(capability.permissions);
const missingCommandPermissions = Array.from(registeredCommands)
  .filter(command => !allowedCommands.has(command))
  .sort();
const missingCapabilityPermissions = Array.from(registeredCommands)
  .map(command => allowedCommands.get(command))
  .filter(identifier => identifier && !capabilityPermissions.has(identifier))
  .sort();

if (missingCommandPermissions.length || missingCapabilityPermissions.length) {
  if (missingCommandPermissions.length) {
    console.error(`Registered Tauri commands missing ACL definitions: ${missingCommandPermissions.join(", ")}`);
  }
  if (missingCapabilityPermissions.length) {
    console.error(`Tauri command permissions missing from default capability: ${missingCapabilityPermissions.join(", ")}`);
  }
  process.exit(1);
}
console.log(`[tauri-preflight] ACL covers all ${registeredCommands.size} registered commands.`);

const resources = spawnSync(process.execPath, ["script/verify-v5-resources.mjs"], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
if (resources.stdout) process.stdout.write(resources.stdout);
if (resources.stderr) process.stderr.write(resources.stderr);
if (resources.status !== 0) process.exit(resources.status || 1);

const result = spawnSync(
  "cargo",
  ["check", "--manifest-path", "src-tauri/Cargo.toml", "--message-format", "short"],
  { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, shell: process.platform === "win32" },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  const compilerTail = `${result.stdout || ""}\n${result.stderr || ""}`
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .slice(-120)
    .join("\n")
    .trim() || "Rust preflight failed without a compiler message.";
  const safe = compilerTail
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
  process.stdout.write(`::error title=Rust preflight details::${safe}\n`);
  process.exit(result.status || 1);
}