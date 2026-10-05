// Compiled-in replacements for legacy production commands. The one-use server
// ticket is still consumed before these are used; renderer scripts are forbidden.
fn desktop_safe_command(id: &str) -> Option<&'static str> {
    match id {
        "EnableNvidiaMSIPro" => Some(r#"
$ErrorActionPreference = 'Stop'
$physical = @(Get-PnpDevice -PresentOnly -Class Display | Where-Object {
  $_.Status -eq 'OK' -and $_.InstanceId -match '(?i)^PCI\\VEN_(10DE|1002|8086)&'
})
$nvidia = @($physical | Where-Object { $_.InstanceId -match '(?i)^PCI\\VEN_10DE&' })
if ($nvidia.Count -ne 1 -or $physical.Count -ne 1) { throw 'NVIDIA MSI requires one active physical NVIDIA GPU. Hybrid or multiple physical GPUs are not changed. Virtual display adapters are ignored.' }
$gpu = $nvidia[0]
$base = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.InstanceId)\Device Parameters\Interrupt Management"
$msi = "$base\MessageSignaledInterruptProperties"
$affinity = "$base\Affinity Policy"
if (!(Test-Path -LiteralPath $msi)) { throw 'Windows did not expose MSI capability for this NVIDIA GPU. No changes were made.' }
$before = Get-ItemPropertyValue -LiteralPath $msi -Name MSISupported
if ($before -notin @(0,1)) { throw 'Unsupported MSI capability value. No changes were made.' }
$oldPriority = (Get-ItemProperty -LiteralPath $affinity -Name DevicePriority -ErrorAction SilentlyContinue).DevicePriority
try {
  New-Item -Path $affinity -Force | Out-Null
  Set-ItemProperty -LiteralPath $msi -Name MSISupported -Value 1 -Type DWord
  Set-ItemProperty -LiteralPath $affinity -Name DevicePriority -Value 3 -Type DWord
  if ((Get-ItemPropertyValue -LiteralPath $msi -Name MSISupported) -ne 1 -or (Get-ItemPropertyValue -LiteralPath $affinity -Name DevicePriority) -ne 3) { throw 'Windows did not verify NVIDIA MSI enabled and High priority.' }
} catch {
  Set-ItemProperty -LiteralPath $msi -Name MSISupported -Value $before -Type DWord -ErrorAction SilentlyContinue
  if ($null -eq $oldPriority) { Remove-ItemProperty -LiteralPath $affinity -Name DevicePriority -ErrorAction SilentlyContinue }
  else { Set-ItemProperty -LiteralPath $affinity -Name DevicePriority -Value $oldPriority -Type DWord -ErrorAction SilentlyContinue }
  throw
}
Write-Host "Verified MSI enabled and interrupt priority High for $($gpu.FriendlyName). Restart Windows to activate the device setting. No other display adapter was changed."
"#),
        "ProcSvc_TabletInput" => Some(r#"
$ErrorActionPreference = 'Stop'
$service = Get-CimInstance Win32_Service -Filter "Name='TabletInputService'" -ErrorAction SilentlyContinue
if (!$service) { Write-Host 'Tablet Input service is not installed; nothing to change.'; return }
if ($service.StartMode -ne 'Disabled') { Set-Service -Name TabletInputService -StartupType Manual }
$after = Get-CimInstance Win32_Service -Filter "Name='TabletInputService'"
if ($after.StartMode -notin @('Manual','Disabled')) { throw 'Tablet Input startup mode was not verified.' }
Write-Host 'Tablet Input is Manual or Disabled. An existing Disabled setting was preserved.'
"#),
        "WinTitusDiskCleanup" => Some(r#"
$ErrorActionPreference = 'Stop'
if (Get-Process -Name cleanmgr -ErrorAction SilentlyContinue) {
  Write-Host 'Disk Cleanup is already open. No second window was launched.'
} else {
  Start-Process -FilePath "$env:SystemRoot\System32\cleanmgr.exe" -ArgumentList '/d C' -WindowStyle Normal
  Write-Host 'One Disk Cleanup window opened. Review the files manually; the optimizer can continue. No browser, launcher, or login data was deleted automatically.'
}
"#),
        "FiveMCacheClear" => Some(r#"
$ErrorActionPreference = 'Stop'
if (Get-Process -Name FiveM,GTA5,PlayGTAV,RockstarGamesLauncher -ErrorAction SilentlyContinue) { throw 'Close FiveM, GTA V and Rockstar Launcher before cleaning resource caches. No files were removed.' }
$data = Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app\data'
foreach ($folder in @('server-cache','server-cache-priv')) {
  $target = Join-Path $data $folder
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}
Write-Host 'FiveM server resource caches cleaned. Authentication, priv, NUI storage, Rockstar profiles and saved login data were preserved.'
"#),
        "FiveMFixProductId" => Some(r#"
$ErrorActionPreference = 'Stop'
$ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
foreach ($exe in @('RockstarGamesLauncher.exe','PlayGTAV.exe','SocialClubHelper.exe','GTA5.exe','FiveM.exe')) {
  $key = Join-Path $ifeo $exe
  if (Test-Path -LiteralPath $key) {
    foreach ($name in @('MitigationOptions','MitigationAuditOptions','Debugger')) {
      Remove-ItemProperty -LiteralPath $key -Name $name -ErrorAction SilentlyContinue
    }
  }
}
$service = Get-Service -Name 'Rockstar Service' -ErrorAction SilentlyContinue
if ($service) { Set-Service -Name 'Rockstar Service' -StartupType Manual }
Write-Host 'FiveM launch restrictions repaired. Rockstar/FiveM authentication and cached logins were not deleted.'
"#),
        _ => None,
    }
}
