/** Deliberately narrower than WinUtil/ReviOS: no driver/input/security/update
 * services, no service deletion and no svchost isolation changes. */
export const BACKGROUND_SERVICE_NAMES = [
  "DiagTrack", "MapsBroker", "RetailDemo", "Fax", "WMPNetworkSvc", "PhoneSvc", "RemoteRegistry",
  "WerSvc", "wercplsupport", "AJRouter", "dmwappushservice",
  "diagnosticshub.standardcollector.service", "MessagingService", "WalletService",
  "SharedRealitySvc", "AssignedAccessManagerSvc", "AppVClient", "PushToInstall",
] as const;

export function buildSafeBackgroundDebloat(): string {
  return String.raw`$ErrorActionPreference = 'Stop'
$names = @(${BACKGROUND_SERVICE_NAMES.map(name => `'${name}'`).join(",")})
$activeFeatureServices = @('AJRouter','diagnosticshub.standardcollector.service','MessagingService','WalletService','SharedRealitySvc','AssignedAccessManagerSvc','AppVClient','PushToInstall')
$directory = Join-Path $env:ProgramData 'OptiGods'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$backupPath = Join-Path $directory 'background-debloat-before.json'
$settings = @(
  @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications'; Name='GlobalUserDisabled'; Value=1 },
  @{ Path='HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent'; Name='DisableWindowsConsumerFeatures'; Value=1 }
)
$backup = @{ Services=@(); Settings=@() }
if (Test-Path -LiteralPath $backupPath) {
  $saved = Get-Content -LiteralPath $backupPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  $backup.Services = @($saved.Services)
  $backup.Settings = @($saved.Settings)
}
foreach ($name in $names) {
  $service = Get-Service -Name $name -ErrorAction Ignore
  if (-not $service) { Write-Output "[INFO] Already debloated: $name is not installed."; continue }
  $config = Get-CimInstance Win32_Service -Filter "Name='$name'" -ErrorAction Stop
  if (-not $config) { throw "Could not read $name before changing it." }
  if (-not @($backup.Services | Where-Object { $_.Name -eq $name }).Count) {
    $backup.Services += @{ Name=$name; Mode=$config.StartMode; Running=($service.Status -eq 'Running') }
  }
}
foreach ($setting in $settings) {
  if (-not @($backup.Settings | Where-Object { $_.Path -eq $setting.Path -and $_.Name -eq $setting.Name }).Count) {
    $item = Get-ItemProperty -LiteralPath $setting.Path -ErrorAction Ignore
    $exists = $item -and $item.PSObject.Properties.Name -contains $setting.Name
    $backup.Settings += @{ Path=$setting.Path; Name=$setting.Name; Exists=[bool]$exists; Value=$(if($exists){$item.($setting.Name)}else{$null}) }
  }
}
$backup | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $backupPath -Encoding UTF8 -ErrorAction Stop
$before = @(Get-Process -ErrorAction Stop).Count
foreach ($name in $names) {
  $service = Get-Service -Name $name -ErrorAction Ignore
  if (-not $service) { continue }
  if ($name -in $activeFeatureServices -and $service.Status -eq 'Running') {
    Write-Output "[INFO] $name preserved: its optional feature is currently active."
    continue
  }
  $config = Get-CimInstance Win32_Service -Filter "Name='$name'" -ErrorAction Stop
  # Do not re-enable a service the user/OS already disabled.
  if ($config.StartMode -ne 'Disabled') {
    Set-Service -Name $name -StartupType Manual -ErrorAction Stop
    if ((Get-CimInstance Win32_Service -Filter "Name='$name'" -ErrorAction Stop).StartMode -ne 'Manual') {
      throw "Manual startup was not verified for $name."
    }
  }
  if ($service.Status -eq 'Running') {
    if (@($service.DependentServices | Where-Object { $_.Status -eq 'Running' }).Count) {
      Write-Output "[INFO] $name kept running because another running service depends on it."
    } else {
      # No Force: Windows is allowed to refuse stopping a busy service.
      Stop-Service -Name $name -ErrorAction Stop
      if ((Get-Service -Name $name -ErrorAction Stop).Status -ne 'Stopped') { throw "$name did not stop." }
    }
  }
  Write-Output "[OK] $($name): verified optional background service reduction."
}
foreach ($setting in $settings) {
  New-Item -Path $setting.Path -Force -ErrorAction Stop | Out-Null
  New-ItemProperty -LiteralPath $setting.Path -Name $setting.Name -PropertyType DWord -Value $setting.Value -Force -ErrorAction Stop | Out-Null
  if ((Get-ItemPropertyValue -LiteralPath $setting.Path -Name $setting.Name -ErrorAction Stop) -ne $setting.Value) {
    throw "Background policy readback failed: $($setting.Name)"
  }
}
$after = @(Get-Process -ErrorAction Stop).Count
Write-Output "[OK] WinUtil-inspired background reduction verified. Process samples: $before before, $after after. Other processes may start/exit; reboot for startup changes."
Write-Output "[INFO] Optional app removals remain your Full Optimize selections. NVIDIA, input devices, Windows Update, Defender, networking, audio and service-host isolation were preserved."
Write-Output "[INFO] Original settings saved for Restore background debloat in Fixes & Restore."
`;
}
