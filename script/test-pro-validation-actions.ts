import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRO_VALIDATION_COMMANDS } from "../server/pro-validation-commands";
import { PRO_VALIDATION_ACTION_IDS, validationActionCompatible } from "../shared/pro-validation-actions";
import { buildSafePreset, isHardwareCompatible, type PresetHardware } from "../shared/preset-builder";
import { NATIVE_TWEAK_ID_SET } from "../shared/native-tweak-ids";
import { getMissingRecommendationIds } from "../client/src/lib/missing-recommendations";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";

const rig: PresetHardware = {
  gpuVendor: "nvidia", gpuName: "GTX 1650 Super", cpuBrand: "amd",
  cpuLabel: "Ryzen 5 3500", cpuCores: 6, osVersion: "win10", ramGB: 16,
};
for (const id of PRO_VALIDATION_ACTION_IDS) {
  assert(isHardwareCompatible(id, rig).ok);
  assert(!NATIVE_TWEAK_ID_SET.has(id), "Free 15 must never include these Pro tests");
  assert(!buildSafePreset(rig).core.includes(id), "Unverified tests must not enter automatic Full Optimize");
  assert(!validationActionCompatible(id, { ...rig, osVersion: "unknown" })?.ok);
  const command = PRO_VALIDATION_COMMANDS[id];
  assert(command.includes("$stage = 'PREFLIGHT'"));
  assert(command.includes("HRESULT="));
  assert(command.includes("Write-Output \"[OK]"));
  assert(buildSingleTweakPowerShell(id, command)?.includes("__OG_RESULT:FAILED"));
}
assert(!isHardwareCompatible("NvidiaMsiModeValidation", { ...rig, gpuVendor: "amd" }).ok);
assert(!isHardwareCompatible("DirectXFiveMCacheRefresh", { ...rig, gpuVendor: "intel" }).ok);
assert(isHardwareCompatible("WindowsGameModeAlignment", { ...rig, gpuVendor: "amd" }).ok);
assert.equal(validationActionCompatible("GameModeTweaks", rig), undefined);
const msi = PRO_VALIDATION_COMMANDS.NvidiaMsiModeValidation;
assert(msi.includes("^PCI\\\\VEN_10DE&"));
assert(msi.includes("$gpus.Count -ne 1"));
assert(msi.includes("$stage = 'CAPABILITY'"));
assert(msi.indexOf("Save-RegistrySnapshot @(") < msi.indexOf("Set-ItemProperty -LiteralPath $path"));
assert(!msi.includes("-Name 'DevicePriority'"));
const cache = PRO_VALIDATION_COMMANDS.DirectXFiveMCacheRefresh;
assert(!cache.includes("EmptyWorkingSet"));
assert(cache.includes("ReparsePoint"));
assert(cache.includes("Assert-GameClosed\n  Remove-Item"));
assert(cache.includes("$item.Name -ne 'subprocess'"));
assert(cache.includes("(exe|dll|asi|sys)"));
assert(!cache.includes("Remove-Item -LiteralPath $root"));
const mode = PRO_VALIDATION_COMMANDS.WindowsGameModeAlignment;
assert(mode.includes("GpuPreference=2"));
assert(mode.includes("AutoGameModeEnabled"));
assert(mode.includes("GameDVR_Enabled"));
assert(mode.includes("DoNotExpandEnvironmentNames"));
assert(mode.includes("Flush($true)"));
assert(mode.includes("SetAccessRuleProtection($true, $false)"));
assert(mode.indexOf("Save-RegistrySnapshot $entries") < mode.indexOf("Set-ItemProperty -LiteralPath $entry.Path"));

const missing = getMissingRecommendationIds(PRO_VALIDATION_ACTION_IDS, {
  native: true, stateReady: true, appliedState: { DirectXFiveMCacheRefresh: true }, selectedState: {},
});
assert.deepEqual(missing, ["WindowsGameModeAlignment", "NvidiaMsiModeValidation"]);
assert.deepEqual(getMissingRecommendationIds(PRO_VALIDATION_ACTION_IDS, {
  native: true, stateReady: true,
  appliedState: { DirectXFiveMCacheRefresh: true, WindowsGameModeAlignment: true, NvidiaMsiModeValidation: true },
  selectedState: {}, runStatus: "failed", runItems: [{ id: "WindowsGameModeAlignment", status: "failed" }],
}), ["WindowsGameModeAlignment"], "Failure must remain retryable even with previous applied history");
for (const page of ["dashboard", "system-scan", "tweaks"]) {
  assert(readFileSync(`client/src/pages/${page}.tsx`, "utf8").includes("getProValidationActionIds(native, isPro)"));
}
const routes = readFileSync("server/routes.ts", "utf8");
assert(routes.includes("...PRO_VALIDATION_COMMANDS"));
assert(routes.includes('"ImportNvidiaPresetPro", ...PRO_VALIDATION_ACTION_IDS'));
console.log("Pro validation checks passed: eligibility, missing-only retries, Pro/free separation, preset exclusion, cache protections, typed backup ordering and readback/error stages.");
