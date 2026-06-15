/**
 * V2.2 smoke test — generates representative reapply PS1 fixtures and
 * (when run on Windows in CI) parses them with the PowerShell AST parser
 * to fail the build on any syntax error in TWEAK_COMMANDS.
 *
 * Extraction strategy: we read `server/routes.ts` as text and pull each
 * `Identifier: \`...\`,` entry from the TWEAK_COMMANDS block. This avoids
 * importing routes.ts (which starts the Express server on import).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const NVIDIA_REAPPLY = [
  "NvTextureFilterHighPerf","NvLowLatencyUltra","NvThreadedOptOn","NvPowerMgmtMax",
  "NvFrameLimitOff","NvFrameLimit30","NvFrameLimit60","NvFrameLimit120",
  "NvFrameLimit144","NvFrameLimit240","NvFrameLimitCustom","EnableMSIMode_Safe",
];
const AMD_REAPPLY = [
  "AmdTextureFilterPerf","AmdSurfaceFormatOpt","AmdTessOverride16x","AmdRadeonBoostOff",
  "AmdFRTC60","AmdFRTC144","AmdFRTC240","EnableMSIMode_Safe",
];

function extractTweakCommands(): Record<string, string> {
  const src = readFileSync(join(process.cwd(), "server", "routes.ts"), "utf8");
  const startIdx = src.indexOf("const TWEAK_COMMANDS");
  if (startIdx < 0) throw new Error("TWEAK_COMMANDS block not found in server/routes.ts");
  // Find the matching closing `};` by counting brace depth from the first `{`.
  const braceOpen = src.indexOf("{", startIdx);
  let depth = 0;
  let endIdx = -1;
  let inTemplate = false; // inside `…` — skip braces (PS scriptblocks contain `{`/`}`)
  let inSingle = false;   // inside '…' single-quoted JS string
  let inDouble = false;   // inside "…" double-quoted JS string
  let inLineCmt = false;
  for (let i = braceOpen; i < src.length; i++) {
    const ch = src[i];
    const prev = src[i - 1];
    if (inLineCmt) { if (ch === "\n") inLineCmt = false; continue; }
    if (inTemplate) { if (ch === "`" && prev !== "\\") inTemplate = false; continue; }
    if (inSingle)   { if (ch === "'" && prev !== "\\") inSingle = false; continue; }
    if (inDouble)   { if (ch === '"' && prev !== "\\") inDouble = false; continue; }
    if (ch === "/" && src[i + 1] === "/") { inLineCmt = true; continue; }
    if (ch === "`")  { inTemplate = true; continue; }
    if (ch === "'")  { inSingle = true; continue; }
    if (ch === '"')  { inDouble = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  if (endIdx < 0) throw new Error("could not find end of TWEAK_COMMANDS block");
  const block = src.slice(braceOpen + 1, endIdx);

  const out: Record<string, string> = {};
  // Match `  Identifier: `...`,` — backtick-quoted, may contain escaped backticks.
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*`([\s\S]*?)`\s*,?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const id = m[1];
    // Decode TS template literal escapes: \\ -> \, \` -> `, \$ -> $
    const cmd = m[2].replace(/\\`/g, "`").replace(/\\\$/g, "$").replace(/\\\\/g, "\\");
    out[id] = cmd;
  }
  return out;
}

const TWEAK_COMMANDS = extractTweakCommands();
console.log(`[smoke-test] extracted ${Object.keys(TWEAK_COMMANDS).length} tweak commands`);

const outDir = join(process.cwd(), ".local", "ps1-smoke");
mkdirSync(outDir, { recursive: true });

function buildScript(label: string, ids: string[]): string {
  const header = `# Opti Gods by leaq — Reapply ${label} (SMOKE TEST FIXTURE)\r\n$ErrorActionPreference = 'Continue'\r\n\r\n`;
  const body = ids.map((id) => {
    const cmd = TWEAK_COMMANDS[id];
    if (!cmd) throw new Error(`SMOKE TEST: missing TWEAK_COMMANDS["${id}"]`);
    return `# --- ${id} ---\r\n${cmd}`;
  }).join("\r\n\r\n");
  return header + body + `\r\n\r\nWrite-Host "Smoke OK"\r\n`;
}

// Cross-category sample — exercises the full script-generation path with
// tweaks from NVIDIA, AMD, and MSI categories in one combined fixture.
// CI parses this with the PowerShell AST to catch any TWEAK_COMMANDS regressions.
const MIXED_SAMPLE = [
  "NvTextureFilterHighPerf",
  "NvLowLatencyUltra",
  "NvPowerMgmtMax",
  "AmdTextureFilterPerf",
  "AmdSurfaceFormatOpt",
  "AmdRadeonBoostOff",
  "EnableMSIMode_Safe",
];

const fixtures: Array<[string, string[]]> = [
  ["nvidia-all", NVIDIA_REAPPLY],
  ["amd-all", AMD_REAPPLY],
  ["nvidia-frame-custom", ["NvFrameLimitCustom"]],
  ["msi-safe-only", ["EnableMSIMode_Safe"]],
  ["mixed-cross-category", MIXED_SAMPLE],
];

let total = 0;
for (const [name, ids] of fixtures) {
  const script = buildScript(name, ids);
  const path = join(outDir, `${name}.ps1`);
  writeFileSync(path, "\ufeff" + script, "utf8");
  console.log(`[smoke-test] wrote ${path} (${script.length} chars, ${ids.length} tweaks)`);
  total++;
}

console.log(`[smoke-test] OK — ${total} fixture(s) ready in ${outDir}`);
console.log(`[smoke-test] In CI, the build-windows workflow then parses each .ps1 with PowerShell's AST to fail on syntax errors.`);
