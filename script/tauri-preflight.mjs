import { spawnSync } from "node:child_process";

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