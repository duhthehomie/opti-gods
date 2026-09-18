import { spawnSync } from "node:child_process";

const result = spawnSync(
  "cargo",
  ["check", "--manifest-path", "src-tauri/Cargo.toml", "--message-format", "short"],
  { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, shell: process.platform === "win32" },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  const lines = `${result.stdout || ""}\n${result.stderr || ""}`
    .split(/\r?\n/)
    .filter(line => /\berror(?:\[|:)|failed to compile|could not compile/i.test(line))
    .slice(-20);
  for (const line of lines.length ? lines : ["Rust preflight failed without a compiler message."]) {
    const safe = line
      .replace(/%/g, "%25")
      .replace(/\r/g, "%0D")
      .replace(/\n/g, "%0A");
    process.stdout.write(`::error title=Rust preflight::${safe}\n`);
  }
  process.exit(result.status || 1);
}