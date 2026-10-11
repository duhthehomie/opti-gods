import assert from "node:assert/strict";
import { buildNativeBatchCommandFix } from "../server/native-batch-command-fixes";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";
import { writeFileSync } from "node:fs";

const fix = (id: string, original = "") => {
  const command = buildNativeBatchCommandFix(id, original);
  assert(command, `No correction for ${id}`);
  return command;
};
assert(fix("ServiceFax").includes("Get-Service -Name $name -ErrorAction Ignore"));
assert(fix("ServiceFax").includes("None of the requested services are installed"));
assert(fix("ServiceFax").includes("$after.StartMode -ne 'Disabled'"));
assert(fix("ProcSvc_cbdhsvc", "Get-Service 'cbdhsvc_*' -EA SilentlyContinue").includes("'cbdhsvc_*'"));
assert(fix("PrivacyDiagFeedback").includes("Get-ItemPropertyValue"));
assert(fix("DisablePowerThrottlingAdv").includes("New-Item -Path $p"));
assert(fix("FiveMDisableLSO").includes("-NoRestart"));
assert(!fix("FiveMDisableLSO").includes("Set-NetAdapterAdvancedProperty"));
assert(fix("NetTCPAutotuneAggressive").includes("set supplemental template=internet"));
assert(!fix("NetTCPAutotuneAggressive").includes("set global congestionprovider"));
assert(fix("DiscordClearCache").includes("Close Discord before"));
assert(fix("NvidiaTripleBufferOff").includes("[SKIP]"));
assert(fix("AmdCpuCapabilities").includes("[SKIP]"));
assert(fix("FiveMi5CoreAffinity", "Write-Output '[OK]'").includes("Intel.*i5-"));
assert(fix("FiveM5060LowLatency", "Write-Output '[OK]'").includes("RTX\\s*5060"));
assert.equal(buildNativeBatchCommandFix("UnknownId", "throw 'do not run'"), undefined);

const cases = [
  { name: "success", id: "FixtureSuccess", command: "Write-Output '[OK] fixture'", code: 0, marker: "APPLIED" },
  { name: "expected-missing-service", id: "FixtureProbe", command: "Get-Service -Name OptiGodsDefinitelyMissingFixtureService -EA SilentlyContinue | Out-Null; Write-Output '[OK] probe completed'", code: 0, marker: "APPLIED" },
  { name: "missing-registry-property", id: "FixtureRemove", command: "Remove-ItemProperty -LiteralPath 'HKCU:\\Software\\OptiGodsDefinitelyMissingFixture' -Name Missing -EA SilentlyContinue; Write-Output '[OK] already absent'", code: 0, marker: "APPLIED" },
  { name: "failed-write", id: "FixtureFailure", command: "Write-Error 'fixture write denied' -ErrorAction SilentlyContinue; Write-Output '[OK] must not hide the error'", code: 1, marker: "FAILED" },
  { name: "explicit-skip", id: "FixtureSkip", command: "Write-Output '[SKIP] prerequisite missing'; return", code: 2, marker: "SKIPPED" },
  { name: "skip-does-not-hide-write-error", id: "FixtureFailure", command: "Write-Output '[SKIP] prerequisite missing'; Write-Error 'fixture write denied' -EA SilentlyContinue", code: 1, marker: "FAILED" },
  { name: "native-exit-failure", id: "FixtureNative", command: "& cmd.exe /c 'exit 7'", code: 1, marker: "FAILED" },
  { name: "missing-startup-entry", id: "su_fixture", command: 'reg delete "HKCU\\Software\\OptiGodsDefinitelyMissingFixture" /v Missing /f 2>$null; Write-Output "[OK] already absent"', code: 0, marker: "APPLIED" },
  { name: "mutation-suppression-not-normalized", id: "FixtureFailure", command: "Set-ItemProperty -Path 'HKLM:\\OptiGodsDefinitelyMissingFixture' -Name Missing -Value 1 -EA SilentlyContinue; Write-Output '[OK] must fail'", code: 1, marker: "FAILED" },
  { name: "parser-does-not-edit-quoted-text", id: "FixtureQuote", command: "Write-Output 'Get-Service Missing -EA SilentlyContinue'", code: 0, marker: "APPLIED" },
];
if (process.argv.includes("--generate-windows-fixtures")) {
  writeFileSync("script/native-wrapper-fixtures.json", JSON.stringify(cases.map(({ command, id, ...test }) => ({
    ...test, script: buildSingleTweakPowerShell(id, command),
  })), null, 2) + "\n");
}
console.log("PASS: native batch command corrections preserve readback, skips, hardware targeting, no-restart networking, and mutation failures.");
