import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMissingRecommendationIds } from "../client/src/lib/missing-recommendations";
import { canRunNvidiaPreset, getPendingNvidiaPresetIds, isCurrentNvidiaPresetVerified, NVIDIA_PRESET_REQUEUE_RELEASE_KEY } from "../client/src/lib/nvidia-preset-eligibility";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null } });
const input = { native: true, pro: true, hardwareScanned: true, dedicatedNvidiaGpuCount: 1 };
const options = { native: true, stateReady: true, selectedState: {}, appliedState: {} };
let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
check("old release verification does not satisfy the new preset revision", () => {
  storage.set("optigods-nvidia-preset-requeue-v5.2.52", "verified");
  assert.equal(isCurrentNvidiaPresetVerified(), false);
  assert.deepEqual(getPendingNvidiaPresetIds(input), ["NvidiaPreviewPerformance", "NvidiaPhysxGpu", "NvidiaControlPanelSettings"]);
});
check("a current verified preset is no longer pending", () => {
  storage.set(NVIDIA_PRESET_REQUEUE_RELEASE_KEY, "verified");
  assert.equal(isCurrentNvidiaPresetVerified(), true);
  assert.deepEqual(getPendingNvidiaPresetIds(input), ["NvidiaPreviewPerformance", "NvidiaPhysxGpu"]);
});
check("unsupported or unauthorized NVIDIA topologies cannot queue", () => {
  for (const value of [{ ...input, native: false }, { ...input, pro: false }, { ...input, hardwareScanned: false }, { ...input, dedicatedNvidiaGpuCount: 0 }, { ...input, dedicatedNvidiaGpuCount: 2 }]) {
    assert.equal(canRunNvidiaPreset(value), false);
    assert.deepEqual(getPendingNvidiaPresetIds(value), []);
  }
});
check("forced pending preset overrides an old applied history entry", () => {
  assert.deepEqual(getMissingRecommendationIds(["NvidiaControlPanelSettings"], { ...options, appliedState: { NvidiaControlPanelSettings: true }, forcePendingIds: ["NvidiaControlPanelSettings"] }), ["NvidiaControlPanelSettings"]);
});
check("Windows false beats a previous script success", () => {
  assert.deepEqual(getMissingRecommendationIds(["FiveM1650VRAMBudget"], { ...options, appliedState: { FiveM1650VRAMBudget: false }, runStatus: "completed", runItems: [{ id: "FiveM1650VRAMBudget", status: "applied" }] }), ["FiveM1650VRAMBudget"]);
});
check("verified script success leaves the missing count and duplicates are deduplicated", () => {
  assert.deepEqual(getMissingRecommendationIds(["FiveM1650VRAMBudget", "FiveM1650VRAMBudget"], { ...options, appliedState: { FiveM1650VRAMBudget: true }, runStatus: "completed", runItems: [{ id: "FiveM1650VRAMBudget", status: "applied" }] }), []);
});
check("failed and skipped scripts are not counted as success", () => {
  assert.deepEqual(getMissingRecommendationIds(["CodDefenderExclusion", "FiveM1650VRAMBudget"], { ...options, runStatus: "failed", runItems: [{ id: "CodDefenderExclusion", status: "failed" }, { id: "FiveM1650VRAMBudget", status: "skipped" }] }), ["CodDefenderExclusion", "FiveM1650VRAMBudget"]);
});
check("Defender is imported before command availability is checked", () => {
  const code = buildSafeWindowsCommandOverride("CodDefenderExclusion")!;
  assert(code.indexOf("Import-Module") < code.indexOf("Get-Command"));
  assert(code.includes("[SKIP] Microsoft Defender"));
});
check("MSI targets one PCI NVIDIA device and verifies High priority", () => {
  const code = buildSafeWindowsCommandOverride("EnableNvidiaMSIPro")!;
  assert(code.includes("$nvidia.Count -ne 1"));
  assert(code.includes("VEN_10DE"));
  assert(code.includes("-Name 'DevicePriority' -Value 3"));
  assert(code.includes("-Name 'DevicePriority' -ErrorAction Stop) -ne 3"));
  assert(code.includes("previous values were restored"));
});
check("VRAM flags replace old values and are read back", () => {
  const code = buildSafeWindowsCommandOverride("FiveM1650VRAMBudget")!;
  assert(code.includes("[regex]::Replace"));
  assert(code.includes("Get-Content -LiteralPath $path -Raw -ErrorAction Stop"));
  assert(code.includes("previous contents were restored"));
});
check("native scripts save their machine receipt only after the success marker", () => {
  const code = readFileSync(new URL("../src-tauri/src/commands/misc.rs", import.meta.url), "utf8");
  assert(code.indexOf("registry::write_qword", code.indexOf("pub async fn run_script_tweak")) > code.indexOf("&& applied_marker", code.indexOf("pub async fn run_script_tweak")));
  assert(code.includes("Command::new(crate::commands::windows_powershell_executable())"));
});
console.log(`${checks} release-preparation checks passed. These are not Windows runtime tests.`);
