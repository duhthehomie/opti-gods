
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
