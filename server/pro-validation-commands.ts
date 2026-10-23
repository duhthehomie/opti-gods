/**
 * Server-owned Windows test actions. No command text comes from the renderer.
 * Failure codes include the stage; success is emitted only after readback.
 */
const PREFLIGHT = String.raw`
$ErrorActionPreference = 'Stop'
$stage = 'PREFLIGHT'
function Assert-GameClosed {
  $games = @(Get-Process -ErrorAction Stop | Where-Object { $_.ProcessName -match '^(FiveM($|_)|GTA5($|_)|PlayGTAV$|GTAVLauncher$)' })
  if ($games.Count) { throw "Close FiveM/GTA first: $($games.ProcessName -join ', ')." }
}
function Get-GameExecutables {
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'FiveM'),
    (Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app'),
    (Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app\data\cache\subprocess')
  )
  $ini = Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app\CitizenFX.ini'
  if (Test-Path -LiteralPath $ini -PathType Leaf) {
    foreach ($line in (Get-Content -LiteralPath $ini -ErrorAction Stop)) {
      if ($line -match '^\s*IVPath\s*=\s*(.+)\s*$') { $roots += $Matches[1].Trim().Trim('"') }
    }
  }
  foreach ($registryPath in @('HKLM:\SOFTWARE\Rockstar Games\Grand Theft Auto V','HKLM:\SOFTWARE\WOW6432Node\Rockstar Games\Grand Theft Auto V')) {
    if (Test-Path -LiteralPath $registryPath) {
      $properties = Get-ItemProperty -LiteralPath $registryPath -ErrorAction Stop
      if ($properties.InstallFolder) { $roots += [string]$properties.InstallFolder }
    }
  }
  $files = @()
  foreach ($root in ($roots | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $root -PathType Container) {
      $files += @(Get-ChildItem -LiteralPath $root -File -ErrorAction Stop | Where-Object { $_.Name -match '^(FiveM(?:_(?:b\d+_)?GTAProcess)?|GTA5(?:_Enhanced)?)\.exe$' })
    }
  }
  @($files | Select-Object -ExpandProperty FullName -Unique)
}
function Save-RegistrySnapshot([object[]]$Entries, [string]$Action) {
  # Use typed, unexpanded values; an unreadable value must NOT become "absent".
  $snapshot = @()
  foreach ($entry in $Entries) {
    $exists = $false; $kind = $null; $value = $null
    if (Test-Path -LiteralPath $entry.Path) {
      $key = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
      if ($key.GetValueNames() -contains $entry.Name) {
        $exists = $true
        $kind = $key.GetValueKind($entry.Name).ToString()
        $value = $key.GetValue($entry.Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        if ($kind -eq 'Binary') { $value = [Convert]::ToBase64String($value) }
      }
    }
    $snapshot += @{ Path=$entry.Path; Name=$entry.Name; Exists=$exists; Kind=$kind; Value=$value }
  }
  $directory = Join-Path $env:ProgramData 'OptiGods-ValidationBackups'
  if (Test-Path -LiteralPath $directory) {
    if ((Get-Item -LiteralPath $directory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup directory cannot be a reparse point.' }
  } else { New-Item -Path $directory -ItemType Directory -ErrorAction Stop | Out-Null }
  $acl = New-Object System.Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner([System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
  foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
    $identity = [System.Security.Principal.SecurityIdentifier]::new($sid)
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
  }
  Set-Acl -LiteralPath $directory -AclObject $acl -ErrorAction Stop
  $file = Join-Path $directory ($Action + '-' + [guid]::NewGuid().ToString('N') + '.json')
  $bytes = [Text.Encoding]::UTF8.GetBytes((@{ Action=$Action; CreatedUtc=[DateTime]::UtcNow.ToString('o'); Values=$snapshot } | ConvertTo-Json -Depth 12))
  $stream = [IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  Write-Output "[BACKUP] Original typed registry values saved to $file"
}
if ([Environment]::OSVersion.Version.Build -lt 10240) { throw 'Windows 10 or 11 is required.' }
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run the Windows app as administrator.' }
`;

const CACHE = String.raw`
$stage = 'GAME_RUNNING'; Assert-GameClosed
$stage = 'DISCOVERY'
$roots = @(
  (Join-Path $env:LOCALAPPDATA 'NVIDIA\DXCache'),
  (Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app\data\cache')
)
$existing = @($roots | Where-Object { Test-Path -LiteralPath $_ -PathType Container })
if (-not $existing.Count) { throw 'No NVIDIA DXCache or FiveM cache folder was found. Nothing was deleted.' }
$stage = 'PATH_SAFETY'
# Enumerate everything before deleting; never follow directory junctions/symlinks.
$files = @()
foreach ($root in $existing) {
  $current = Get-Item -LiteralPath $root -Force -ErrorAction Stop
  while ($current) {
    if ($current.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Cache path crosses a reparse point: $($current.FullName)" }
    $current = $current.Parent
  }
  $queue = New-Object 'System.Collections.Generic.Queue[string]'
  $queue.Enqueue($root)
  while ($queue.Count) {
    foreach ($item in (Get-ChildItem -LiteralPath $queue.Dequeue() -Force -ErrorAction Stop)) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Cache contains a reparse point: $($item.FullName)" }
      # FiveM can keep downloaded runtime binaries in cache/subprocess.
      if ($item.PSIsContainer) {
        if ($item.Name -ne 'subprocess') { $queue.Enqueue($item.FullName) }
      } elseif ($item.Extension -notmatch '^\.(exe|dll|asi|sys)$') { $files += $item.FullName }
    }
  }
}
$stage = 'DELETE'
$deleted = 0
foreach ($file in $files) {
  Assert-GameClosed
  Remove-Item -LiteralPath $file -Force -ErrorAction Stop
  if (Test-Path -LiteralPath $file) { throw "Cache file remained after deletion: $file" }
  $deleted++
}
$stage = 'VERIFY'; Assert-GameClosed
Write-Output "[OK] Verified deletion of $deleted cache files from $($existing.Count) existing cache folder(s). Missing folders were left absent; game files and server-cache folders were not touched. Shader caches rebuild on the next launch."
`;

const GAME_MODE = String.raw`
$stage = 'GAME_RUNNING'; Assert-GameClosed
$stage = 'DISCOVERY'
$executables = @(Get-GameExecutables)
if (-not $executables.Count) { throw 'No installed FiveM/GTA executable was found. Launch FiveM once to record its GTA path, then close it and retry.' }
$bar = 'HKCU:\Software\Microsoft\GameBar'
$gpu = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
$entries = @(
  @{Path=$bar;Name='AutoGameModeEnabled';Value=1;Kind='DWord'},
  @{Path=$bar;Name='AllowAutoGameMode';Value=1;Kind='DWord'},
  @{Path='HKCU:\System\GameConfigStore';Name='GameDVR_Enabled';Value=0;Kind='DWord'},
  @{Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR';Name='AppCaptureEnabled';Value=0;Kind='DWord'}
)
foreach ($exe in $executables) {
  $preference = ''
  if (Test-Path -LiteralPath $gpu) {
    $gpuKey = Get-Item -LiteralPath $gpu -ErrorAction Stop
    if ($gpuKey.GetValueNames() -contains $exe) {
      if ($gpuKey.GetValueKind($exe).ToString() -ne 'String') { throw "Unsupported graphics-preference registry type for $exe" }
      $preference = [string]$gpuKey.GetValue($exe)
    }
  }
  $tokens = @($preference -split ';' | Where-Object { $_ -and $_ -notmatch '^\s*GpuPreference=' })
  $value = (($tokens + @('GpuPreference=2')) -join ';') + ';'
  $entries += @{Path=$gpu;Name=$exe;Value=$value;Kind='String'}
}
$stage = 'BACKUP'; Save-RegistrySnapshot $entries 'WindowsGameModeAlignment'
$stage = 'WRITE'
foreach ($entry in $entries) {
  if (-not (Test-Path -LiteralPath $entry.Path)) { New-Item -Path $entry.Path -Force -ErrorAction Stop | Out-Null }
  Set-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -Value $entry.Value -Type $entry.Kind -Force -ErrorAction Stop
}
$stage = 'VERIFY'
foreach ($entry in $entries) {
  $key = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
  if ($key.GetValueKind($entry.Name).ToString() -ne $entry.Kind -or [string]$key.GetValue($entry.Name) -cne [string]$entry.Value) { throw "Readback failed: $($entry.Path) / $($entry.Name)" }
}
Write-Output "[OK] Game Mode enabled, Windows background game capture disabled, and High performance graphics preference verified for $($executables.Count) installed FiveM/GTA executables. Windows selects the adapter; NVIDIA recording and overlays were not changed."
`;

const MSI = String.raw`
$stage = 'DISCOVERY'
$gpus = @(Get-PnpDevice -Class Display -PresentOnly -ErrorAction Stop | Where-Object { $_.Status -eq 'OK' -and $_.InstanceId -match '^PCI\\VEN_10DE&' })
if ($gpus.Count -ne 1) { throw "Exactly one active PCI NVIDIA display adapter is required; detected $($gpus.Count). No devices were changed." }
$device = $gpus[0]
$path = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($device.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
$stage = 'CAPABILITY'
if (-not (Test-Path -LiteralPath $path)) { throw 'The NVIDIA driver did not expose an MSI capability key. No key was invented.' }
$key = Get-Item -LiteralPath $path -ErrorAction Stop
if ($key.GetValueNames() -notcontains 'MSISupported' -or $key.GetValueKind('MSISupported').ToString() -ne 'DWord' -or $key.GetValue('MSISupported') -notin @(0,1)) { throw 'MSISupported must already exist as DWORD 0 or 1. No device was changed.' }
$stage = 'BACKUP'; Save-RegistrySnapshot @(@{Path=$path;Name='MSISupported'}) 'NvidiaMsiModeValidation'
$stage = 'WRITE'
Set-ItemProperty -LiteralPath $path -Name 'MSISupported' -Value 1 -Type DWord -Force -ErrorAction Stop
$stage = 'VERIFY'
$after = Get-Item -LiteralPath $path -ErrorAction Stop
if ($after.GetValueKind('MSISupported').ToString() -ne 'DWord' -or $after.GetValue('MSISupported') -ne 1) { throw 'NVIDIA MSISupported=1 did not read back.' }
Write-Output "[OK] NVIDIA MSI registry configuration verified for $($device.FriendlyName). Restart Windows before testing runtime interrupts. Other adapters, NICs, NVMe, affinity, and interrupt priority were not changed."
`;

function action(prefix: string, body: string): string {
  return `try {\n${PREFLIGHT}\n${body}\n} catch { throw ("${prefix}-" + $stage + " | " + $_.Exception.Message + " | HRESULT=" + $_.Exception.HResult) }`;
}

export const PRO_VALIDATION_COMMANDS: Readonly<Record<string, string>> = {
  DirectXFiveMCacheRefresh: action("OG-CACHE", CACHE),
  WindowsGameModeAlignment: action("OG-GAMEMODE", GAME_MODE),
  NvidiaMsiModeValidation: action("OG-MSI", MSI),
};
