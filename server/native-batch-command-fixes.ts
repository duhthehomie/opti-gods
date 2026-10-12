import { buildLoggedCommandFix } from "./native-logged-command-fixes";

const LEGACY_DRIVER_KEYS = new Set([
  "NvidiaTripleBufferOff", "NvidiaForceVSyncOff", "FiveMDisablePhysX",
  "NvidiaCUDAPriority", "NvidiaShaderCacheUnlimited", "NvidiaFrameBufferOpt",
]);

function servicesCommand(names: string[], mode: "Manual" | "Disabled"): string {
  return String.raw`$ErrorActionPreference = 'Stop'
$names = @(${names.map(name => `'${name}'`).join(",")})
$changed = 0
$managed = 0
foreach ($name in $names) {
  $services = @(Get-Service -Name $name -ErrorAction Ignore)
  foreach ($service in $services) {
    $typePath = "HKLM:\SYSTEM\CurrentControlSet\Services\$($service.Name)"
    $serviceType = Get-ItemPropertyValue -LiteralPath $typePath -Name Type -ErrorAction Stop
    if (($serviceType -band 0x40) -ne 0 -or ($serviceType -band 0x80) -ne 0) {
      $managed++
      Write-Output "[INFO] Windows-managed per-user service $($service.Name) was left unchanged."
      continue
    }
    $escaped = $service.Name.Replace("'", "''")
    $configuration = Get-CimInstance Win32_Service -Filter "Name='$escaped'" -ErrorAction Stop
    if (-not $configuration) { throw "Could not read service configuration: $($service.Name)" }
    if ($configuration.StartMode -ne '${mode}') {
      Set-Service -Name $service.Name -StartupType ${mode} -ErrorAction Stop
    }
    ${mode === "Disabled" ? "if ($service.Status -ne 'Stopped') { Stop-Service -Name $service.Name -Force -ErrorAction Stop }" : ""}
    $after = Get-CimInstance Win32_Service -Filter "Name='$escaped'" -ErrorAction Stop
    if ($after.StartMode -ne '${mode}') { throw "Service startup mode was not verified: $($service.Name)" }
    ${mode === "Disabled" ? "if ((Get-Service -Name $service.Name -ErrorAction Stop).Status -ne 'Stopped') { throw \"Service did not stop: $($service.Name)\" }" : ""}
    $changed++
  }
}
if ($changed -eq 0 -and $managed -gt 0) { Write-Output '[SKIP] Matching services are Windows-managed per-user services; nothing was changed.'; return }
if ($changed -eq 0) { Write-Output '[SKIP] None of the requested services are installed; nothing was changed.'; return }
Write-Output "[OK] Verified ${mode} startup for $changed installed service(s)."
`;
}

/** Corrections to the actions called out by the real Windows batch logs. */
export function buildNativeBatchCommandFix(id: string, original: string): string | undefined {
  const loggedFix = buildLoggedCommandFix(id, original);
  if (loggedFix !== undefined) return loggedFix;
  if (LEGACY_DRIVER_KEYS.has(id)) {
    return `Write-Output '[SKIP] This legacy registry action does not reliably configure the current NVIDIA driver. Use the verified Opti Gods NVIDIA Preset; PhysX remains a separate Control Panel action.'; return`;
  }
  if (id === "AmdCpuCapabilities") {
    return "Write-Output '[SKIP] This undocumented processor capability override is not a verified performance setting. No processor registry value was changed.'; return";
  }
  if (id.startsWith("ProcSvc_") && id !== "ProcSvc_ApplyAll") {
    const match = original.match(/(?:Get-Service|Stop-Service|Set-Service)(?:\s+-Name)?\s+['"]([^'"]+)['"]/);
    if (match) return servicesCommand([match[1]], "Manual");
  }
  if (id === "ServiceFax") return servicesCommand(["Fax"], "Disabled");
  if (id === "ServiceTabletInput") return servicesCommand(["TabletInputService"], "Disabled");
  if (id === "ServiceAeLookupSvc") return servicesCommand(["AeLookupSvc"], "Disabled");
  if (id === "WinTitusServicesManual" || id === "ProcSvc_ApplyAll") {
    const array = original.match(/\$svcs\s*=\s*@\(([^)]+)\)/);
    const names = array ? Array.from(array[1].matchAll(/'([^']+)'/g)).map(match => match[1]) : [];
    if (names.length) return servicesCommand(names, "Manual");
  }
  if (id === "PrivacyDiagFeedback") {
    return String.raw`$p = 'HKCU:\SOFTWARE\Microsoft\Siuf\Rules'
if (-not (Test-Path -LiteralPath $p)) { New-Item -Path $p -Force -ErrorAction Stop | Out-Null }
New-ItemProperty -LiteralPath $p -Name 'NumberOfSIUFInPeriod' -Value 0 -PropertyType DWord -Force -ErrorAction Stop | Out-Null
if ((Get-ItemPropertyValue -LiteralPath $p -Name 'NumberOfSIUFInPeriod' -ErrorAction Stop) -ne 0) { throw 'Feedback policy did not read back as disabled.' }
Write-Output '[OK] Feedback policy disabled and read back.'`;
  }
  if (id === "ProcessTrimWorkingSet") {
    return String.raw`Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OptiGodsWorkingSet {
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, uint id);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
  [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr handle);
}
'@ -ErrorAction Stop
$session = (Get-Process -Id $PID -ErrorAction Stop).SessionId
$trimmed = 0
foreach ($process in (Get-Process -ErrorAction Stop | Where-Object { $_.SessionId -eq $session -and $_.Id -ne $PID -and $_.ProcessName -notmatch '(?i)opti.?gods' })) {
  $handle = [OptiGodsWorkingSet]::OpenProcess(0x500, $false, [uint32]$process.Id)
  if ($handle -eq [IntPtr]::Zero) { continue }
  try { if ([OptiGodsWorkingSet]::EmptyWorkingSet($handle)) { $trimmed++ } }
  finally { $null = [OptiGodsWorkingSet]::CloseHandle($handle) }
}
if (-not $trimmed) { Write-Output '[SKIP] No accessible user-session working sets could be trimmed.'; return }
Write-Output "[OK] Windows confirmed working-set trimming for $trimmed user-session process(es); protected processes were left alone."`;
  }
  if (id === "FiveMGameModeAdd") {
    return String.raw`$gameBar = 'HKCU:\SOFTWARE\Microsoft\GameBar'
$store = 'HKCU:\System\GameConfigStore\Children'
foreach ($path in @($gameBar,$store)) { if (-not (Test-Path -LiteralPath $path)) { New-Item -Path $path -Force -ErrorAction Stop | Out-Null } }
Set-ItemProperty -LiteralPath $gameBar -Name 'AllowAutoGameMode' -Value 1 -Type DWord -ErrorAction Stop
Set-ItemProperty -LiteralPath $gameBar -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -ErrorAction Stop
$exes = @('GTA5.exe','FiveM.exe','FiveM_b2189_GTAProcess.exe','FiveM_b2545_GTAProcess.exe','FiveM_b2612_GTAProcess.exe','FiveM_b2699_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2944_GTAProcess.exe','FiveM_b3095_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3407_GTAProcess.exe','FiveM_b3441_GTAProcess.exe')
$existing = @(Get-ChildItem -LiteralPath $store -ErrorAction Stop | ForEach-Object { (Get-ItemProperty -LiteralPath $_.PSPath -Name ChildAppID -ErrorAction Ignore).ChildAppID })
foreach ($exe in $exes) {
  if ($existing -contains $exe) { continue }
  $key = Join-Path $store ([Guid]::NewGuid().ToString('B'))
  New-Item -Path $key -Force -ErrorAction Stop | Out-Null
  Set-ItemProperty -LiteralPath $key -Name ChildAppID -Value $exe -Type String -ErrorAction Stop
  $existing += $exe
}
Write-Output '[OK] Game Mode enabled and FiveM/GTA executable entries written with readback; existing entries were not duplicated.'`;
  }
  if (id === "DisablePowerThrottlingAdv") {
    return String.raw`$p = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling'
if (-not (Test-Path -LiteralPath $p)) { New-Item -Path $p -Force -ErrorAction Stop | Out-Null }
New-ItemProperty -LiteralPath $p -Name 'PowerThrottlingOff' -Value 1 -PropertyType DWord -Force -ErrorAction Stop | Out-Null
if ((Get-ItemPropertyValue -LiteralPath $p -Name 'PowerThrottlingOff' -ErrorAction Stop) -ne 1) { throw 'Power throttling policy did not read back as disabled.' }
Write-Output '[OK] Power throttling policy disabled and verified. Restart Windows to activate the policy.'`;
  }
  if (id === "FiveMDisableLSO" || id === "NetDisableLargeSendOffload") {
    return String.raw`$adapters = @(Get-NetAdapter -ErrorAction Stop | Where-Object Status -eq 'Up')
if (-not $adapters.Count) { Write-Output '[SKIP] No active network adapter is available.'; return }
foreach ($adapter in $adapters) {
  Disable-NetAdapterLso -Name $adapter.Name -NoRestart -Confirm:$false -ErrorAction Stop
  $after = Get-NetAdapterLso -Name $adapter.Name -ErrorAction Stop
  if ($after.IPv4Enabled -or $after.IPv6Enabled) { throw "LSO disable was not verified on $($adapter.Name)." }
  Write-Output "[OK] LSO configuration disabled and verified on $($adapter.Name), without restarting the adapter. Restart Windows after this batch to activate it."
}`;
  }
  if (id === "NetTCPAutotuneAggressive") {
    return String.raw`$before = Get-NetTCPSetting -SettingName Internet -ErrorAction Stop
$output = & netsh.exe interface tcp set supplemental template=internet congestionprovider=ctcp 2>&1
if ($LASTEXITCODE -ne 0) { throw "Windows rejected CTCP for the Internet template: $output" }
$output = & netsh.exe interface tcp set global autotuninglevel=experimental 2>&1
if ($LASTEXITCODE -ne 0) {
  $failure = "$output"
  & netsh.exe interface tcp set supplemental template=internet "congestionprovider=$($before.CongestionProvider)" 2>&1 | Out-Null
  throw "Windows rejected experimental TCP autotuning: $failure"
}
$after = Get-NetTCPSetting -SettingName Internet -ErrorAction Stop
if ($after.CongestionProvider -ne 'CTCP' -or $after.AutoTuningLevelLocal -ne 'Experimental') { throw 'TCP configuration did not read back as CTCP / Experimental.' }
Write-Output '[OK] TCP Experimental autotuning and CTCP Internet-template configuration verified.'`;
  }
  if (id === "FortniteAffinityPhysical") {
    return original.replace(/-EA SilentlyContinue/g, "-EA Ignore")
      .replace(/\[Fortnite\] Launch Fortnite first/g, "[SKIP] Launch Fortnite first");
  }
  if (id === "DiscordClearCache") {
    return String.raw`if (Get-Process -Name Discord -ErrorAction Ignore) { Write-Output '[SKIP] Close Discord before clearing its cache; no cache files were removed.'; return }
$dirs = @("$env:APPDATA\discord\Cache","$env:APPDATA\discord\Code Cache","$env:APPDATA\discord\GPUCache","$env:APPDATA\discord\blob_storage")
$found = 0
foreach ($dir in $dirs) {
  if (-not (Test-Path -LiteralPath $dir)) { continue }
  $found++
  Get-ChildItem -LiteralPath $dir -Force -ErrorAction Stop | Remove-Item -Recurse -Force -ErrorAction Stop
  if (@(Get-ChildItem -LiteralPath $dir -Force -ErrorAction Stop).Count) { throw "Discord cache was not fully cleared: $dir" }
}
if (-not $found) { Write-Output '[SKIP] No Discord cache folders are installed.'; return }
Write-Output '[OK] Discord cache folders cleared and verified.'`;
  }
  if (id === "FiveMi5CoreAffinity") {
    return String.raw`$cpu = (Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1).Name
if ($cpu -notmatch '(?i)Intel.*i5-') { Write-Output '[SKIP] This Intel i5 affinity action does not apply to this CPU.'; return }
` + original;
  }
  if (id === "FiveM5060LowLatency") {
    return String.raw`$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction Stop)
if (-not ($gpus | Where-Object Name -Match '(?i)RTX\s*5060')) { Write-Output '[SKIP] This RTX 5060-specific action does not apply to this GPU.'; return }
` + original;
  }
  return undefined;
}
