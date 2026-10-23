import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PRO_VALIDATION_COMMANDS } from "../server/pro-validation-commands";
import { PRO_VALIDATION_ACTION_IDS, validationActionCompatible } from "../shared/pro-validation-actions";
import { buildSafePreset, isHardwareCompatible, type PresetHardware } from "../shared/preset-builder";
import { NATIVE_TWEAK_ID_SET } from "../shared/native-tweak-ids";
import { getMissingRecommendationIds } from "../client/src/lib/missing-recommendations";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";

if (existsSync("src-tauri/resources/native-tweak-scripts.json")) {
  const bundled = JSON.parse(readFileSync("src-tauri/resources/native-tweak-scripts.json", "utf8"));
  assert.equal(bundled.DirectXFiveMCacheRefresh,
    buildSingleTweakPowerShell("DirectXFiveMCacheRefresh", PRO_VALIDATION_COMMANDS.DirectXFiveMCacheRefresh),
    "The installer must contain the current reviewed cache command, not depend on the deployed backend");
  assert(readFileSync("src-tauri/build.rs", "utf8").includes("'DirectXFiveMCacheRefresh'"),
    "The reviewed cache action must remain in the exact build-time allowlist");
}

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
assert(cache.includes("Assert-GameClosed\n  $errorsBeforeDelete"));
assert(cache.includes("Remove-Item -LiteralPath $file -Force -ErrorAction Stop"));
assert(cache.includes("($Exception.HResult -band 0xFFFF) -in @(32,33)"));
assert(cache.includes("$Exception = $Exception.InnerException"));
assert(cache.includes("$global:Error.Remove($record)"), "Remove only handled sharing errors from the strict wrapper's error history");
assert(cache.includes("$errorsBeforeDelete -notcontains $record"));
assert(cache.includes("'D3DSCache'"), "Include Windows' DirectX shader cache");
assert(cache.includes("else { $deleteErrors +="), "Non-lock failures must remain errors");
assert(cache.includes("if ($deleteErrors.Count)"), "Do not report success after permission/deletion errors");
assert(cache.includes("$lockedFiles.Count -and $deleted -eq 0 -and $gone -eq 0"), "All-locked cleanup must be an honest no-op");
assert(cache.includes("[SKIP] No files removed: all"));
assert(cache.includes("files in use were left untouched (partial cleanup)"));
assert(cache.includes("Removed and verified $deleted cache files"));
assert(!cache.includes("Stop-Process"), "Never kill driver or desktop processes to clear a cache");
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
assert(mode.includes("$stage = 'BASELINE'"));
assert(mode.includes("$entry.Before = '<absent>'"));
assert(mode.includes("foreach ($entry in $changes)"), "Write only mismatched values");
assert(mode.includes("[OK] Already configured."));
assert(mode.includes("No settings changed."));
assert(mode.includes("'CHANGED' } else { 'ALREADY ALIGNED'"));
assert(mode.includes("Save-ValidationReport 'WindowsGameModeAlignment' $details"));
assert(!mode.includes("Before -> verified after:"), "Do not put registry dumps in user-facing results");
assert(mode.indexOf("Readback failed:") < mode.indexOf('$details += "[$status]'), "Report changes only after verified readback");

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
