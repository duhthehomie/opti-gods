/**
 * V2.2 smoke test — generates representative reapply PS1 fixtures and
 * (when run on Windows in CI) parses them with the PowerShell AST parser
 * to fail the build on any syntax error in TWEAK_COMMANDS.
 *
 * Extraction strategy: we read `server/routes.ts` as text and pull each
 * `Identifier: \`...\`,` entry from the TWEAK_COMMANDS block. This avoids
 * importing routes.ts (which starts the Express server on import).
 */
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";
import { buildNativeBatchCommandFix } from "../server/native-batch-command-fixes";
import { PRO_VALIDATION_COMMANDS } from "../server/pro-validation-commands";
import { runProValidationPowerShellChecks } from "../script/test-pro-validation-powershell";
import { REVIEWED_PERFORMANCE_COMMANDS, REVIEWED_PERFORMANCE_UNDO } from "../server/cs2-network-commands";
import { extractTweakCommands } from "./tweak-command-source";
import { buildRegistryTargets, REGISTRY_TARGETS_FILE, renderRegistryTargetsFile } from "./generate-tweak-registry-targets";

const NVIDIA_REAPPLY = [
  "NvTextureFilterHighPerf","NvLowLatencyUltra","NvThreadedOptOn","NvPowerMgmtMax",
  "EnableMSIMode_Safe",
];
const AMD_REAPPLY = [
  "AmdTextureFilterPerf","AmdSurfaceFormatOpt","AmdTessOverride16x","AmdRadeonBoostOff",
  "AmdFRTC60","AmdFRTC144","AmdFRTC240","EnableMSIMode_Safe",
];

const TWEAK_COMMANDS = extractTweakCommands();
console.log(`[smoke-test] extracted ${Object.keys(TWEAK_COMMANDS).length} tweak commands`);

const outDir = join(process.cwd(), ".local", "ps1-smoke");
mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir)) {
  if (name.endsWith(".ps1")) unlinkSync(join(outDir, name));
}

function buildScript(label: string, ids: string[]): string {
  const header = `# Opti Gods by leaq — Reapply ${label} (SMOKE TEST FIXTURE)\r\n$ErrorActionPreference = 'Continue'\r\n\r\n`;
  const body = ids.map((id) => {
    const cmd = buildNativeBatchCommandFix(id, TWEAK_COMMANDS[id] ?? "") ?? buildSafeWindowsCommandOverride(id) ?? TWEAK_COMMANDS[id];
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
  ["msi-safe-only", ["EnableMSIMode_Safe"]],
  ["mixed-cross-category", MIXED_SAMPLE],
  ["verified-failure-paths", ["CodDefenderExclusion", "FiveM3500PerfPlan", "IntelOldGenPowerOpt", "EnableNvidiaMSIPro", "DisableSearchIndexing"]],
  ["ryzen-2600-failure-corrections", ["DisableCoreParking", "Win11ParkingCoreOverride", "Win11ProcessorIdleMin", "su_chrome", "FiveMSteamOverlayOff", "Win11Widgets", "ProcSvc_cbdhsvc", "ProcSvc_OneSyncSvc", "ProcSvc_ApplyAll", "WinTitusAdobeBlock", "WinTitusEdgeRemove"]],
];

let total = 0;
function rejectBareVariableColon(script: string, name: string) {
  const invalid = script.match(/\$[A-Za-z_]\w*:(?=\s|["`]|$)/m);
  if (invalid) throw new Error(`${name}: invalid PowerShell interpolation ${invalid[0]}; delimit the variable before the colon.`);
}
for (const [name, ids] of fixtures) {
  const script = buildScript(name, ids);
  rejectBareVariableColon(script, name);
  const path = join(outDir, `${name}.ps1`);
  writeFileSync(path, "\ufeff" + script, "utf8");
  console.log(`[smoke-test] wrote ${path} (${script.length} chars, ${ids.length} tweaks)`);
  total++;
}

for (const [id, script] of Object.entries(PRO_VALIDATION_COMMANDS)) {
  rejectBareVariableColon(script, id);
  writeFileSync(join(outDir, `${id}.ps1`), "\ufeff" + script, "utf8");
  total++;
}

for (const name of ["windows-repair", "windows-background-undo"]) {
  const script = readFileSync(join(process.cwd(), "src-tauri", "src", "commands", `${name}.ps1`), "utf8");
  rejectBareVariableColon(script, name);
  writeFileSync(join(outDir, `${name}.ps1`), "\ufeff" + script, "utf8");
  total++;
}
// Parse the bundled repair script in the existing Windows AST check, without
// running DISM/SFC or changing the build runner's Windows installation.
const repairSource = readFileSync(join(process.cwd(), "src-tauri", "src", "commands", "windows-repair.ps1"), "utf8");
rejectBareVariableColon(repairSource, "windows-repair");
writeFileSync(join(outDir, "windows-repair.ps1"), repairSource, "utf8");
total++;
// The admin recorder's read-only telemetry sampler runs on every Live Monitor
// poll; a parse error would silently drop CPU/GPU/RAM and game detection.
const samplerSource = readFileSync(join(process.cwd(), "src-tauri", "src", "commands", "performance_sample.ps1"), "utf8");
rejectBareVariableColon(samplerSource, "performance-sample");
writeFileSync(join(outDir, "performance-sample.ps1"), "\ufeff" + samplerSource, "utf8");
total++;
console.log(`[smoke-test] OK — ${total} fixture(s) ready in ${outDir}`);
for (const [id, command] of Object.entries(REVIEWED_PERFORMANCE_COMMANDS)) {
  for (const [suffix, script] of [["apply", command], ["undo", REVIEWED_PERFORMANCE_UNDO[id]]]) {
    rejectBareVariableColon(script, `${id}-${suffix}`);
    writeFileSync(join(outDir, `${id}-${suffix}.ps1`), "\ufeff" + script, "utf8");
  }
}
console.log(`[smoke-test] In CI, the build-windows workflow then parses each .ps1 with PowerShell's AST to fail on syntax errors.`);
runProValidationPowerShellChecks();

// The admin recorder's read-only tweak audit depends on this generated file;
// fail the build if it no longer matches TWEAK_COMMANDS.
{
  // Compare ignoring line endings: Windows CI checks files out with CRLF.
  const expected = renderRegistryTargetsFile(buildRegistryTargets(TWEAK_COMMANDS)).replace(/\r\n/g, "\n");
  const actual = readFileSync(REGISTRY_TARGETS_FILE, "utf8").replace(/\r\n/g, "\n");
  if (actual !== expected) {
    throw new Error("client/src/generated/tweak-registry-targets.ts is stale: run npx tsx scripts/generate-tweak-registry-targets.ts");
  }
  console.log("[smoke-test] tweak registry targets are current");
}
