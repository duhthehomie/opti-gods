/** Corrections for the Ryzen 5 2600 diagnostic run. Never infer applied from output alone. */
export function buildLoggedCommandFix(id: string, original: string): string | undefined {
  if (id === "DisableCoreParking" || id === "Win11ParkingCoreOverride") {
    return String.raw`$sub = '54533251-82be-4824-96c1-47b60b740d00'
$setting = '0cc5b647-c1df-4637-891a-dec35c318583'
$metadata = "HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\$sub\$setting"
if (-not (Test-Path -LiteralPath $metadata)) { Write-Output '[SKIP] Windows does not expose the core-parking setting; nothing was changed.'; return }
# Earlier commands set ValueMax to zero, making a 100-percent index invalid.
foreach ($entry in @(@('ValueMin',0), @('ValueMax',100))) {
  $name = $entry[0]; $value = [int]$entry[1]
  if ((Get-ItemPropertyValue -LiteralPath $metadata -Name $name -ErrorAction Stop) -ne $value) {
    Set-ItemProperty -LiteralPath $metadata -Name $name -Value $value -Type DWord -ErrorAction Stop
  }
  if ((Get-ItemPropertyValue -LiteralPath $metadata -Name $name -ErrorAction Stop) -ne $value) { throw "Core-parking range repair failed: $name" }
}
$active = & powercfg.exe /getactivescheme 2>&1
if ($LASTEXITCODE -ne 0) { throw "Could not read active power plan: $active" }
$match = [regex]::Match(($active -join ' '), '[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}')
if (-not $match.Success) { throw 'Windows returned no active power-plan GUID.' }
$plan = $match.Value
$output = & powercfg.exe /setacvalueindex $plan $sub $setting 100 2>&1
if ($LASTEXITCODE -ne 0) { throw "Windows rejected the core-parking index: $output" }
$saved = "HKLM:\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes\$plan\$sub\$setting"
if ((Get-ItemPropertyValue -LiteralPath $saved -Name ACSettingIndex -ErrorAction Stop) -ne 100) { throw 'Core parking did not read back as 100 percent on AC.' }
$output = & powercfg.exe /setactive $plan 2>&1
if ($LASTEXITCODE -ne 0) { throw "Could not activate the updated existing power plan: $output" }
Write-Output '[OK] Core parking set to 100 percent on AC and read back; the existing power plan was retained. SMT and processor idle states were not changed.'`;
  }
  if (id === "Win11ProcessorIdleMin") {
    return "Write-Output '[SKIP] PROCIDLEMIN is not a supported Windows power setting. Disabling all CPU idle states is not a verified gaming improvement and can increase heat. No processor idle setting was changed.'; return";
  }
  if (id === "WinTitusAdobeBlock") {
    return "Write-Output '[SKIP] Blocking Adobe activation is not a CPU or gaming optimization. Adobe licensing and the protected hosts file were left unchanged.'; return";
  }
  if (id === "WinTitusEdgeRemove") {
    return "Write-Output '[SKIP] Forced removal of Windows-managed Edge is not a verified gaming optimization. Edge, WebView2 and their update settings were left unchanged. Use Windows Installed apps if your installation supports removal.'; return";
  }
  if (id === "FiveMSteamOverlayOff") {
    return String.raw`$path = 'HKCU:\SOFTWARE\Valve\Steam'
if (-not (Test-Path -LiteralPath $path)) { Write-Output '[SKIP] Steam is not registered for this Windows user; no overlay setting was changed.'; return }
Set-ItemProperty -LiteralPath $path -Name 'EnableGameOverlay' -Value 0 -Type DWord -ErrorAction Stop
if ((Get-ItemPropertyValue -LiteralPath $path -Name 'EnableGameOverlay' -ErrorAction Stop) -ne 0) { throw 'Steam overlay preference did not read back as disabled.' }
Write-Output '[OK] Steam overlay preference disabled and read back. Restart Steam to activate this setting.'`;
  }
  if (id === "su_chrome") {
    return String.raw`$policy = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
if (-not (Test-Path -LiteralPath $policy)) { New-Item -Path $policy -Force -ErrorAction Stop | Out-Null }
` + original;
  }
  if (id === "Win11Widgets") {
    return String.raw`$policy = 'HKLM:\SOFTWARE\Policies\Microsoft\Dsh'
$taskbar = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
foreach ($path in @($policy,$taskbar)) { if (-not (Test-Path -LiteralPath $path)) { New-Item -Path $path -Force -ErrorAction Stop | Out-Null } }
New-ItemProperty -LiteralPath $policy -Name 'AllowNewsAndInterests' -Value 0 -PropertyType DWord -Force -ErrorAction Stop | Out-Null
Set-ItemProperty -LiteralPath $taskbar -Name 'TaskbarDa' -Value 0 -Type DWord -ErrorAction Stop
if ((Get-ItemPropertyValue -LiteralPath $policy -Name 'AllowNewsAndInterests' -ErrorAction Stop) -ne 0 -or (Get-ItemPropertyValue -LiteralPath $taskbar -Name 'TaskbarDa' -ErrorAction Stop) -ne 0) { throw 'Widgets policy or taskbar preference failed readback.' }
Write-Output '[OK] Widgets disabled by policy and its taskbar button hidden; both values read back. No protected Windows packages were removed. Sign out of Windows to activate the policy.'`;
  }
  return undefined;
}
