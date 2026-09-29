import assert from "node:assert/strict";
import { buildSafePreset, MANUAL_ONLY_TWEAK_IDS } from "../shared/preset-builder";
import { NATIVE_TWEAK_ID_SET } from "../shared/native-tweak-ids";
import { TWEAK_REGISTRY } from "../client/src/lib/tweak-registry";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";

const defender = buildSafeWindowsCommandOverride("CodDefenderExclusion");
assert.ok(defender);
assert.match(defender, /Get-Command -Name/);
assert.match(defender, /Add-MpPreference.*Get-MpPreference.*Remove-MpPreference/s);
assert.match(defender, /did not report the exclusion after adding it/);
assert.match(defender, /Newly added exclusions were rolled back/);
assert.match(defender, /throw "Not for this system: Microsoft Defender command/);
assert.match(defender, /throw "Defender exclusions were not fully verified/);
assert.doesNotMatch(defender, /\[SKIP\].*return/);

const ryzen = buildSafeWindowsCommandOverride("FiveM3500PerfPlan");
assert.ok(ryzen);
assert.doesNotMatch(ryzen, /Name = 'PERFBOOSTMODE'/);
assert.doesNotMatch(ryzen, /Name = 'PERFBOOSTPOL'|Name = 'CPMINCORES'/);
assert.match(ryzen, /powercfg exit/);
assert.match(ryzen, /Original power values and active plan were restored/);
assert.match(ryzen, /restore verification failed/);
assert.match(ryzen, /powercfg\.exe \/query \$candidate/);
assert.match(ryzen, /throw "Not for this system: Ryzen 5 3500 power settings unavailable on scheme/);
assert.match(ryzen, /throw "Ryzen 5 3500 power-plan operation failed/);
assert.doesNotMatch(ryzen, /\[SKIP\].*return/);

const intel = buildSafeWindowsCommandOverride("IntelOldGenPowerOpt");
assert.ok(intel);
assert.doesNotMatch(intel, /Name = 'CPMINCORES'/);
assert.match(intel, /Name = 'PERFBOOSTPOL'/);

const nvidia = buildSafeWindowsCommandOverride("EnableNvidiaMSIPro");
assert.ok(nvidia);
const adapterGuard = nvidia.indexOf("if ($active.Count -ne 1)");
const firstRegistryWrite = nvidia.indexOf("Set-ItemProperty");
assert.ok(adapterGuard >= 0 && firstRegistryWrite > adapterGuard);
assert.match(nvidia, /Not for this system: NVIDIA MSI requires exactly one active display adapter/);
assert.match(nvidia, /No registry values were changed/);
assert.equal(buildSafeWindowsCommandOverride("CodDirectXQueue"), undefined);

const searchIndexer = buildSafeWindowsCommandOverride("DisableSearchIndexing");
assert.ok(searchIndexer);
assert.match(searchIndexer, /Set-Service -Name 'WSearch' -StartupType Disabled -ErrorAction Stop/);
assert.match(searchIndexer, /Stop-Service -Name 'WSearch' -Force -ErrorAction Stop/);
assert.match(searchIndexer, /wait for the service to settle and try again/);
assert.match(searchIndexer, /unsupported startup mode/);
assert.match(searchIndexer, /StartMode -ne 'Disabled'/);
assert.match(searchIndexer, /Original WSearch startup mode and state were restored/);
assert.match(searchIndexer, /Not for this system: Windows Search \(WSearch\) is not installed/);
assert.ok(NATIVE_TWEAK_ID_SET.has("DisableSearchIndexing"));
assert.ok(MANUAL_ONLY_TWEAK_IDS.has("DisableSearchIndexing"));
assert.equal(TWEAK_REGISTRY.find(tweak => tweak.id === "DisableSearchIndexing")?.safety, "aggressive");
const autoPreset = buildSafePreset({ gpuVendor: "unknown" }, "balanced");
assert.ok(!autoPreset.core.includes("DisableSearchIndexing"));
assert.ok(!autoPreset.expert.includes("DisableSearchIndexing"));
const nvidiaAutoPreset = buildSafePreset(
  { gpuVendor: "nvidia", gpuName: "GeForce RTX 3060", cpuBrand: "amd", cpuLabel: "Ryzen 5 3500", cpuCores: 6 },
  "balanced",
);
const nvidiaAutoIds = [...nvidiaAutoPreset.core, ...nvidiaAutoPreset.expert];
for (const id of ["NvidiaDisableOverlay", "NvidiaDisableShadowPlay", "FiveMFixNvidiaOverlay"]) {
  assert.ok(!nvidiaAutoIds.includes(id), `${id} should never be in an automatic NVIDIA preset`);
}
const optedPreset = buildSafePreset({ gpuVendor: "unknown" }, "balanced", ["DisableSearchIndexing"]);
assert.ok(!optedPreset.core.includes("DisableSearchIndexing"));
assert.ok(!optedPreset.expert.includes("DisableSearchIndexing"));
assert.ok(optedPreset.blocked.some(row => row.id === "DisableSearchIndexing"));

const hagsIds = [
  "CodDisableHAGS",
  "FiveM1060DisableHAGS",
  "FiveM1650DisableHAGS",
  "FiveM1650HAGSOffPack",
  "EnableHAGS",
  "FiveM5060EnableHAGS",
  "IGpu_DisableHAGSForIGpu",
  "Lap_DisableHAGS",
];
const hagsPreset = buildSafePreset(
  {
    gpuVendor: "nvidia",
    gpuName: "GTX 1650 SUPER",
    cpuBrand: "amd",
    cpuLabel: "Ryzen 5 3500",
    cpuCores: 6,
    ramGB: 32,
    osVersion: "win10",
  },
  "fps",
  hagsIds,
);
for (const id of hagsIds) {
  assert.ok(MANUAL_ONLY_TWEAK_IDS.has(id), `${id} must be manual-only`);
  assert.ok(!hagsPreset.core.includes(id), `${id} must not be auto-applied`);
  assert.ok(!hagsPreset.expert.includes(id), `${id} must not be auto-applied as an expert tweak`);
}

console.log("Windows command override checks passed.");