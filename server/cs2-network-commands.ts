/** Reviewed actions delivered by the same strict Windows runner as other tweaks. */
const REGISTRY = String.raw`
$ErrorActionPreference = 'Stop'
$stage = 'PREFLIGHT'
function Save-Originals($entries, $name) {
  $dir = Join-Path $env:ProgramData 'OptiGods\ReviewedRegistryActions'
  [IO.Directory]::CreateDirectory($dir) | Out-Null
  $file = Join-Path $dir ($name + '.json')
  $saved = @()
  if (Test-Path -LiteralPath $file) { $saved = @(Get-Content -LiteralPath $file -Raw -ErrorAction Stop | ConvertFrom-Json) }
  foreach ($entry in $entries) {
    if (@($saved | Where-Object { $_.Path -eq $entry.Path -and $_.Name -eq $entry.Name }).Count) { continue }
    $exists = $false; $value = $null; $kind = $entry.Kind
    if (Test-Path -LiteralPath $entry.Path) {
      $key = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
      if ($key.GetValueNames() -contains $entry.Name) {
        $exists = $true; $kind = $key.GetValueKind($entry.Name).ToString()
        if ($kind -notin @('DWord','String')) { throw "Unsupported original registry type: $($entry.Name)" }
        $value = $key.GetValue($entry.Name)
      }
    }
    $saved += [pscustomobject]@{Path=$entry.Path;Name=$entry.Name;Existed=$exists;Kind=$kind;Value=$value}
  }
  $temp = $file + '.tmp'
  ConvertTo-Json -InputObject @($saved) -Depth 5 | Set-Content -LiteralPath $temp -Encoding UTF8 -ErrorAction Stop
  $null = Get-Content -LiteralPath $temp -Raw -ErrorAction Stop | ConvertFrom-Json
  Move-Item -LiteralPath $temp -Destination $file -Force -ErrorAction Stop
}
function Write-Verified($entries) {
  $entries = @($entries)
  $changed = 0
  foreach ($entry in $entries) {
    if (-not (Test-Path -LiteralPath $entry.Path)) { New-Item -Path $entry.Path -Force -ErrorAction Stop | Out-Null }
    $key = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
    if ($key.GetValueNames() -notcontains $entry.Name -or $key.GetValue($entry.Name) -ne $entry.Value -or $key.GetValueKind($entry.Name).ToString() -ne $entry.Kind) { $changed++ }
    New-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -Value $entry.Value -PropertyType $entry.Kind -Force -ErrorAction Stop | Out-Null
    $key = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
    if ($key.GetValue($entry.Name) -ne $entry.Value -or $key.GetValueKind($entry.Name).ToString() -ne $entry.Kind) { throw "Readback failed: $($entry.Name)" }
    Write-Output "[INFO] Verified $($entry.Path) / $($entry.Name) = $($entry.Value)"
  }
  Write-Output "[OK] Verified $($entries.Count) settings; $changed changed, $($entries.Count - $changed) already configured. No FPS or ping improvement is implied."
}
function Restore-Originals($name) {
  $file = Join-Path $env:ProgramData ("OptiGods\ReviewedRegistryActions\" + $name + '.json')
  if (-not (Test-Path -LiteralPath $file)) { throw 'Original-value backup not found; no defaults will be guessed.' }
  $entries = @(Get-Content -LiteralPath $file -Raw -ErrorAction Stop | ConvertFrom-Json)
  foreach ($entry in $entries) {
    $allowed = if ($name -eq 'ActiveAdapterTcpLatency') {
      $entry.Path -match '^HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\\{[0-9a-f-]{36}\}$' -and $entry.Name -in @('TCPNoDelay','TcpAckFrequency','TcpDelAckTicks')
    } else {
      ($entry.Path -eq 'HKCU:\Software\Microsoft\GameBar' -and $entry.Name -in @('AutoGameModeEnabled','AllowAutoGameMode')) -or
      ($entry.Path -eq 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences' -and $entry.Name -match '(?i)\\cs2\.exe$') -or
      ($entry.Path -eq 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cs2.exe\PerfOptions' -and $entry.Name -eq 'CpuPriorityClass')
    }
    if (-not $allowed -or $entry.Kind -notin @('String','DWord') -or $entry.Existed -isnot [bool]) { throw 'Invalid backup entry; restore stopped.' }
  }
  foreach ($entry in $entries) {
    if ($entry.Existed) {
      $value = if ($entry.Kind -eq 'DWord') { [int]$entry.Value } else { [string]$entry.Value }
      Write-Verified @(@{Path=$entry.Path;Name=$entry.Name;Kind=$entry.Kind;Value=$value})
    } elseif (Test-Path -LiteralPath $entry.Path) {
      $key = Get-Item -LiteralPath $entry.Path -ErrorAction Stop
      if ($key.GetValueNames() -contains $entry.Name) { Remove-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -ErrorAction Stop }
      if ((Get-Item -LiteralPath $entry.Path -ErrorAction Stop).GetValueNames() -contains $entry.Name) { throw 'Undo readback failed.' }
    }
  }
  Write-Output '[OK] Original registry values restored and verified.'
}
`;

export const CS2_DISCOVERY = String.raw`
function Find-CS2 {
  $roots = @('C:\Program Files (x86)\Steam','C:\Program Files\Steam')
  foreach ($path in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam')) {
    if (Test-Path -LiteralPath $path) {
      $key = Get-Item -LiteralPath $path -ErrorAction Stop
      foreach ($name in @('SteamPath','InstallPath')) { if ($key.GetValueNames() -contains $name) { $roots += [string]$key.GetValue($name) } }
    }
  }
  foreach ($drive in [IO.DriveInfo]::GetDrives()) {
    if ($drive.IsReady -and $drive.DriveType -eq 'Fixed') {
      foreach ($relative in @('Steam','SteamLibrary','Program Files (x86)\Steam')) { $roots += Join-Path $drive.RootDirectory.FullName $relative }
    }
  }
  foreach ($root in @($roots | Select-Object -Unique)) {
    $vdf = Join-Path $root 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
      foreach ($line in Get-Content -LiteralPath $vdf -ErrorAction Stop) {
        if ($line -match '"path"\s+"([^"]+)"') { $roots += $Matches[1].Replace('\\','\') }
      }
    }
  }
  foreach ($root in @($roots | Select-Object -Unique)) {
    $installDir = 'Counter-Strike Global Offensive'
    $manifest = Join-Path $root 'steamapps\appmanifest_730.acf'
    if (Test-Path -LiteralPath $manifest) {
      $text = Get-Content -LiteralPath $manifest -Raw -ErrorAction Stop
      if ($text -match '"installdir"\s+"([^"]+)"') {
        $installDir = $Matches[1]
        if ($installDir -match '[\\/:]' -or $installDir -in @('.','..')) { throw 'Invalid CS2 install directory in Steam manifest.' }
      }
    }
    $exe = Join-Path $root ("steamapps\common\" + $installDir + '\game\bin\win64\cs2.exe')
    if (Test-Path -LiteralPath $exe -PathType Leaf) { return $exe }
  }
  return $null
}
`;

export const CS2_COMMAND = REGISTRY + CS2_DISCOVERY + String.raw`
try {
  if (@(Get-Process -ErrorAction Stop | Where-Object { $_.ProcessName -eq 'cs2' }).Count) { throw 'Close Counter-Strike 2 before applying its profile.' }
  $exe = Find-CS2
  if (-not $exe) { throw 'CS2 executable not found in Steam libraries. Verify the installation and scan again.' }
  $stage = 'BACKUP'
  $graphics = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
  $preference = ''
  if (Test-Path -LiteralPath $graphics) {
    $key = Get-Item -LiteralPath $graphics -ErrorAction Stop
    if ($key.GetValueNames() -contains $exe) { $preference = [string]$key.GetValue($exe) }
  }
  $preference = (($preference -replace '(?i)GpuPreference=[^;]*;?', '').TrimEnd(';') + ';GpuPreference=2;').TrimStart(';')
  $entries = @(
    @{Path='HKCU:\Software\Microsoft\GameBar';Name='AutoGameModeEnabled';Kind='DWord';Value=1},
    @{Path='HKCU:\Software\Microsoft\GameBar';Name='AllowAutoGameMode';Kind='DWord';Value=1},
    @{Path=$graphics;Name=$exe;Kind='String';Value=$preference},
    @{Path='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cs2.exe\PerfOptions';Name='CpuPriorityClass';Kind='DWord';Value=6}
  )
  Save-Originals $entries 'game_cs2'
  $stage = 'APPLY_VERIFY'; Write-Verified $entries
  Write-Output '[OK] CS2 profile verified: Game Mode enabled, High performance graphics preference, Above Normal launch priority. Launch CS2 again to use these settings.'
} catch { throw ("OG-CS2-" + $stage + ': ' + $_.Exception.Message) }
`;

export const ACTIVE_TCP_COMMAND = REGISTRY + String.raw`
try {
  $routes = @(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
    Where-Object { $_.NextHop -ne '0.0.0.0' } |
    Sort-Object @{Expression={ $ip = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $_.InterfaceIndex -ErrorAction Stop; [int]$_.RouteMetric + [int]$ip.InterfaceMetric }})
  $nic = $null
  foreach ($route in $routes) {
    $candidate = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop
    if ($candidate.Status -eq 'Up') { $nic = $candidate; break }
  }
  if (-not $nic) { throw 'No active IPv4 internet adapter found.' }
  if (-not $nic.HardwareInterface) { throw 'The preferred route uses a VPN/virtual adapter. Disconnect it and retry; no registry changes made.' }
  $guid = ([guid]$nic.InterfaceGuid).ToString('B')
  $path = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$guid"
  if (-not (Test-Path -LiteralPath $path)) { throw 'Active adapter TCP/IP registry key not found.' }
  $entries = @(
    @{Path=$path;Name='TCPNoDelay';Kind='DWord';Value=1},
    @{Path=$path;Name='TcpAckFrequency';Kind='DWord';Value=1},
    @{Path=$path;Name='TcpDelAckTicks';Kind='DWord';Value=0}
  )
  $stage = 'BACKUP'; Save-Originals $entries 'ActiveAdapterTcpLatency'
  $stage = 'APPLY_VERIFY'; Write-Verified $entries
  Write-Output "[OK] Active adapter TCP settings verified for $($nic.Name). Restart Windows. Legacy settings may be ignored; UDP latency is not directly changed."
} catch { throw ("OG-TCP-" + $stage + ': ' + $_.Exception.Message) }
`;

export const REVIEWED_PERFORMANCE_COMMANDS: Record<string, string> = {
  game_cs2: CS2_COMMAND,
  ActiveAdapterTcpLatency: ACTIVE_TCP_COMMAND,
};
export const REVIEWED_PERFORMANCE_UNDO: Record<string, string> = {
  game_cs2: REGISTRY + "\nRestore-Originals 'game_cs2'",
  ActiveAdapterTcpLatency: REGISTRY + "\nRestore-Originals 'ActiveAdapterTcpLatency'",
};
