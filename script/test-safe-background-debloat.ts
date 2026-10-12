import assert from "node:assert/strict";
import { BACKGROUND_SERVICE_NAMES, buildSafeBackgroundDebloat } from "../server/safe-background-debloat";
import { buildNativeBatchCommandFix } from "../server/native-batch-command-fixes";
import { MANUAL_ONLY_TWEAK_IDS } from "../shared/manual-only-tweak-ids";
const script = buildSafeBackgroundDebloat();
assert.equal(BACKGROUND_SERVICE_NAMES.length, 18);
assert.equal(buildNativeBatchCommandFix("WinTitusServicesManual", ""), script);
assert.equal(buildNativeBatchCommandFix("ProcSvc_ApplyAll", ""), script);
assert(script.includes("Already debloated:"));
assert(!script.includes("[SKIP]")); // Missing single services must not skip a successful aggregate pass.
assert(script.includes("$service.DependentServices"));
assert(!script.includes("Stop-Service -Name $name -Force"));
assert(script.includes("background-debloat-before.json"));
assert(script.includes("StartMode -ne 'Disabled'"));
assert(script.includes("Optional app removals remain your Full Optimize selections"));
assert(!/\bsc(?:\.exe)?\s+delete|SvcHostSplitThresholdInKB|Remove-Appx|Remove-Mp|Disable-BitLocker/.test(script));
for (const name of BACKGROUND_SERVICE_NAMES) assert(!/nvidia|nvdisplay|hid|bth|keyboard|mouse|xboxgip|audio|wuauserv|windefend/i.test(name));
for (const id of ["ServiceTabletInput", "ProcSvc_TabletInput", "ProcSvc_BthServ", "ProcSvc_XboxGip", "WinTitusRazerBlock"]) assert(MANUAL_ONLY_TWEAK_IDS.has(id));
console.log("PASS: reversible background debloat preserves drivers, input, security and service isolation.");
