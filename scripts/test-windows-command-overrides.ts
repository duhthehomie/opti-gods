import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSafePreset, MANUAL_ONLY_TWEAK_IDS } from "../shared/preset-builder";
import { NATIVE_TWEAK_ID_SET } from "../shared/native-tweak-ids";
import { TWEAK_REGISTRY } from "../client/src/lib/tweak-registry";
import { buildSafeWindowsCommandOverride } from "../server/windows-tweak-commands";

const defender = buildSafeWindowsCommandOverride("CodDefenderExclusion");
assert.ok(defender);
assert.match(defender, /requiredCmdlets.*Add-MpPreference.*Get-MpPreference.*Remove-MpPreference/);
assert.match(defender, /Get-Command -Name/);
assert.match(defender, /Add-MpPreference.*Get-MpPreference.*Remove-MpPreference/s);
assert.match(defender, /did not report the exclusion after adding it/);
assert.match(defender, /Newly added exclusions were rolled back/);
assert.match(defender, /throw "Not for this system: Microsoft Defender command/);
assert.match(defender, /throw "Defender exclusions were not fully verified/);
assert.doesNotMatch(defender, /\[SKIP\].*return/);

const ryzen = buildSafeWindowsCommandOverride("FiveM3500PerfPlan");
    assert.ok(ryzen);
    // The 3500 action now creates/selects the verified custom Opti Gods plan,
    // rather than silently swapping the user back to a stock plan.
    assert.equal(ryzen, buildSafeWindowsCommandOverride("SetHighPerformancePlan"));
    assert.match(ryzen, /Opti Gods|OptiGods/);
    assert.match(ryzen, /\/setactive \$plan/);
    assert.match(ryzen, /\/getactivescheme/);
    assert.match(ryzen, /did not verify the Opti Gods Power Plan as active/);
    assert.doesNotMatch(ryzen, /\[SKIP\].*return/);

    const intel = buildSafeWindowsCommandOverride("IntelOldGenPowerOpt");
    assert.ok(intel);
    assert.match(intel, /PROCTHROTTLEMIN/);
    assert.match(intel, /SCHEME_CURRENT/);
    assert.doesNotMatch(intel, /PERFBOOSTMODE|PERFBOOSTPOL|8c5e7fda|893dee8e|bc5038f7/);

    const codPlan = buildSafeWindowsCommandOverride("Cod3500PowerPlan");
    assert.ok(codPlan);
    assert.match(codPlan, /SCHEME_CURRENT/);
    assert.doesNotMatch(codPlan, /8c5e7fda|893dee8e|bc5038f7/);

    const nvidia = buildSafeWindowsCommandOverride("EnableNvidiaMSIPro");
    assert.ok(nvidia);
    const adapterGuard = nvidia.indexOf("if ($nvidia.Count -ne 1)");
    const firstRegistryWrite = nvidia.indexOf("Set-ItemProperty");
    assert.ok(adapterGuard >= 0 && firstRegistryWrite > adapterGuard);
    assert.match(nvidia, /exactly one active PCI NVIDIA display adapter/);
    assert.match(nvidia, /PCI\\\\VEN_10DE&/);
    assert.match(nvidia, /No registry values were changed/);
    assert.doesNotMatch(nvidia, /if ($active.Count -ne 1)/);
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

const nativeSafe = readFileSync(new URL("../src-tauri/src/commands/desktop_safe_overrides.rs", import.meta.url), "utf8");
assert.match(nativeSafe, /Get-PnpDevice -PresentOnly -Class Display/);
assert.match(nativeSafe, /physical.Count -ne 1/);
assert.match(nativeSafe, /MSISupported -Value 1/);
assert.match(nativeSafe, /DevicePriority -Value 3/);
assert.match(nativeSafe, /existing Disabled setting was preserved/);
assert.match(nativeSafe, /Disk Cleanup is already open/);
assert.doesNotMatch(nativeSafe, /sagerun|Temporary Internet Files/);
assert.match(nativeSafe, /server-cache','server-cache-priv/);
assert.doesNotMatch(nativeSafe, /Remove-Item.*DigitalEntitlements|Remove-Item.*Social Club|FiveM\.app\\cache\\\*/);
assert.match(nativeSafe, /cached logins were not deleted/);
for (const id of ["WinTitusDiskCleanup", "FiveMCacheClear", "FiveMFixProductId", "OpenMsiUtilityPro"]) {
  assert.ok(MANUAL_ONLY_TWEAK_IDS.has(id), `${id} must stay out of automatic batches`);
}
console.log("Windows command source-guard checks passed.");