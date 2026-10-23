import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRO_VALIDATION_COMMANDS } from "../server/pro-validation-commands";
import { buildSingleTweakPowerShell } from "../server/native-script-delivery";

/** Windows CI only: real file sharing and exact delivery wrapper; no machine settings changed. */
export function runProValidationPowerShellChecks() {
  if (process.platform !== "win32") return;
  const cache = PRO_VALIDATION_COMMANDS.DirectXFiveMCacheRefresh;
  const cacheBody = cache.slice(cache.indexOf("function Test-CacheLockException"), cache.lastIndexOf("\n} catch {"));
  const mode = PRO_VALIDATION_COMMANDS.WindowsGameModeAlignment;
  const modeBody = mode.slice(mode.indexOf("$stage = 'GAME_RUNNING'"), mode.lastIndexOf("\n} catch {"));
  let count = 0;
  function runCase(name: string, prepare: string, command: string, expectedExit: number, verify: (stdout: string, root: string) => void) {
    const root = mkdtempSync(join(tmpdir(), "og-validation-"));
    try {
      mkdirSync(join(root, "NVIDIA", "DXCache"), { recursive: true });
      mkdirSync(join(root, "D3DSCache"), { recursive: true });
      const script = join(root, "test.ps1");
      writeFileSync(script, "\ufeff$ErrorActionPreference='Stop'\n" + prepare + "\n" + command, "utf8");
      const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script], {
        encoding: "utf8", timeout: 30000, env: { ...process.env, LOCALAPPDATA: root },
      });
      assert.ifError(result.error);
      assert.equal(result.status, expectedExit, `${name}: ${result.stdout}\n${result.stderr}`);
      verify(result.stdout, root);
      console.log(`[PowerShell regression] ${name} passed`);
      count++;
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const cacheCommand = buildSingleTweakPowerShell("DirectXFiveMCacheRefresh", "function Assert-GameClosed {}\n" + cacheBody)!;
  const locked = `
$lockedPath = Join-Path $env:LOCALAPPDATA 'NVIDIA\\DXCache\\active.nvph'
[IO.File]::WriteAllText($lockedPath, 'active')
$lockHandle = [IO.File]::Open($lockedPath,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
`;
  runCase("all locked is skipped, not applied or failed", locked, cacheCommand, 2, output => {
    assert(output.includes("[SKIP] No files removed: all 1"));
    assert(output.includes("__OG_RESULT:SKIPPED"));
    assert(!output.includes("__OG_RESULT:APPLIED"));
  });
  runCase("locked NVIDIA file does not prevent real DirectX cleanup", locked + `
$freePath = Join-Path $env:LOCALAPPDATA 'D3DSCache\\unused.cache'
[IO.File]::WriteAllText($freePath, 'unused')
`, cacheCommand, 0, (output, root) => {
    assert(output.includes("Removed and verified 1 cache files"));
    assert(output.includes("1 files in use were left untouched"));
    assert(output.includes("__OG_RESULT:APPLIED"), "Caught locks must not poison the strict wrapper");
    assert(!existsSync(join(root, "D3DSCache", "unused.cache")));
    assert(existsSync(join(root, "NVIDIA", "DXCache", "active.nvph")));
  });
  runCase("empty cache is a valid no-op", "", cacheCommand, 0, output => {
    assert(output.includes("Removed and verified 0 cache files"));
  });
  runCase("access denied remains a real failure", `
[IO.File]::WriteAllText((Join-Path $env:LOCALAPPDATA 'D3DSCache\\denied.cache'), 'preserve')
function Remove-Item {
  [CmdletBinding()] param([string]$LiteralPath,[switch]$Force)
  throw [UnauthorizedAccessException]::new('Regression access denied')
}
`, cacheCommand, 1, (_output, root) => {
    assert.equal(readFileSync(join(root, "D3DSCache", "denied.cache"), "utf8"), "preserve");
  });
  const modeMocks = `
$script:values = @{
  AutoGameModeEnabled=1; AllowAutoGameMode=1; GameDVR_Enabled=0; AppCaptureEnabled=0
  'C:\\Games\\GTA5.exe'='GpuPreference=2;'
}
$script:writes=0; $script:backups=0; $script:reports=0
function Assert-GameClosed {}
function Get-GameExecutables { 'C:\\Games\\GTA5.exe' }
function Test-Path { param($LiteralPath) return $true }
function Get-Item {
  param($LiteralPath)
  $key = [pscustomobject]@{ Values=$script:values }
  $key | Add-Member ScriptMethod GetValueNames { @($this.Values.Keys) }
  $key | Add-Member ScriptMethod GetValueKind { param($name) if ($this.Values[$name] -is [string]) { 'String' } else { 'DWord' } }
  $key | Add-Member ScriptMethod GetValue { param($name,$unused,$options) $this.Values[$name] }
  return $key
}
function Set-ItemProperty {
  [CmdletBinding()] param($LiteralPath,$Name,$Value,$Type,[switch]$Force)
  $script:values[$Name]=$Value; $script:writes++
}
function Save-RegistrySnapshot { param($Entries,$Action) $script:backups++ }
function Save-ValidationReport { param($Action,$Details) $script:reports++; if (@($Details).Count -ne 5) { throw 'Missing before/after details' } }
`;
  const verifyMode = (expectedWrites: number, expectedBackups: number) => `
if ($script:writes -ne ${expectedWrites} -or $script:backups -ne ${expectedBackups} -or $script:reports -ne 1) { throw 'Incorrect mutation/backup/report count' }
`;
  runCase("already configured Game Mode is concise and does not write", modeMocks, modeBody + verifyMode(0, 0), 0, output => {
    assert(output.includes("[OK] Already configured."));
    assert(output.includes("No settings changed."));
    assert(!output.includes("DWord=") && !output.includes("C:\\Games"), "User result must not contain registry dumps");
  });
  runCase("Game Mode changes only mismatches and reports actual changes", modeMocks + `
$script:values.AutoGameModeEnabled=0
$script:values['C:\\Games\\GTA5.exe']='GpuPreference=0;'
`, modeBody + verifyMode(2, 1), 0, output => {
    assert(output.includes("1 Game Mode/capture settings updated; 1 of 1"));
    assert(output.includes("Applied and verified"));
  });
  console.log(`[PowerShell regression] ${count} non-destructive runtime cases passed`);
}
