# Read-only diagnostic snapshot. No registry writes, priorities or game hooks.
$ErrorActionPreference = 'Continue'
$out = [ordered]@{ live = $true; game_running = $false; fivem_running = $false }
$issues = [System.Collections.Generic.List[string]]::new()
try {
  # Win32_Processor load is averaged by Windows over the last second and does
  # not depend on localized performance-counter names or a two-sample warmup.
  $cpus = @(Get-CimInstance Win32_Processor -ErrorAction Stop | Where-Object { $null -ne $_.LoadPercentage })
  if ($cpus.Count) { $out.cpu_load_pct = [math]::Round([double]($cpus | Measure-Object LoadPercentage -Average).Average, 1) }
} catch { $issues.Add("CPU load unavailable: $($_.Exception.Message)") }
try {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $total = [double]$os.TotalVisibleMemorySize
  $free = [double]$os.FreePhysicalMemory
  if ($total -gt 0 -and $free -ge 0 -and $free -le $total) {
    $out.ram_total_gb = [math]::Round($total / 1MB, 2)
    $out.ram_free_gb = [math]::Round($free / 1MB, 2)
    $out.ram_used_pct = [math]::Round(100 * (1 - $free / $total), 1)
  }
  $out.os_caption = [string]$os.Caption
  $out.os_version = [string]$os.Version
  $out.os_build = [string]$os.BuildNumber
} catch { $issues.Add("Windows/RAM query unavailable: $($_.Exception.Message)") }
try {
  $smi = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
  $smiPath = if ($smi) { $smi.Source } else { $null }
  if (-not $smiPath) {
    foreach ($candidate in @("$env:SystemRoot\System32\nvidia-smi.exe", "$env:ProgramFiles\NVIDIA Corporation\NVSMI\nvidia-smi.exe")) {
      if (Test-Path -LiteralPath $candidate) { $smiPath = $candidate; break }
    }
  }
  if ($smiPath) {
    $line = & $smiPath --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1
    $value = 0.0
    if ([double]::TryParse([string]$line, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$value)) {
      if ($value -ge 0 -and $value -le 100) { $out.gpu_load_pct = $value }
    }
  }
  if ($null -eq $out.gpu_load_pct) {
    # Task Manager style: sum each 3D engine across processes, then take the
    # busiest engine. Never add unrelated video/copy engines together.
    $engines = @{}
    foreach ($row in @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop)) {
      if ($row.Name -notmatch 'engtype_3D$') { continue }
      $key = $row.Name -replace '^pid_\d+_', ''
      $engines[$key] = [double]$engines[$key] + [double]$row.UtilizationPercentage
    }
    if ($engines.Count) { $out.gpu_load_pct = [math]::Min(100, [double]($engines.Values | Measure-Object -Maximum).Maximum) }
  }
} catch { $issues.Add("GPU load unavailable: $($_.Exception.Message)") }
try {
  $processes = @(Get-Process -ErrorAction Stop)
  $out.running_processes_count = [int]$processes.Count
  $visible = @($processes | Where-Object { $_.MainWindowHandle -ne 0 })
  $out.visible_apps_count = [int]$visible.Count
  $out.process_names_text = (@($processes | ForEach-Object { "$($_.ProcessName).exe" } | Sort-Object -Unique) -join "`n")
  $out.visible_app_names_text = (@($visible | ForEach-Object { "$($_.ProcessName).exe" } | Sort-Object -Unique) -join "`n")
  $out.fivem_running = @($processes | Where-Object { $_.ProcessName -match '^FiveM($|_)' }).Count -gt 0
  $rules = @(
    @{ id='fivem'; label='FiveM'; pattern='^FiveM(?:_b\d+)?_GTAProcess$' },
    @{ id='gta5'; label='Grand Theft Auto V'; pattern='^GTA5(?:_Enhanced)?$' },
    @{ id='fortnite'; label='Fortnite'; pattern='^FortniteClient-Win64-Shipping$' },
    @{ id='valorant'; label='VALORANT'; pattern='^VALORANT-Win64-Shipping$' },
    @{ id='cs2'; label='Counter-Strike 2'; pattern='^cs2$' },
    @{ id='roblox'; label='Roblox'; pattern='^RobloxPlayerBeta$' },
    @{ id='apex'; label='Apex Legends'; pattern='^r5apex(?:_dx12)?$' },
    @{ id='overwatch'; label='Overwatch'; pattern='^Overwatch$' },
    @{ id='rust'; label='Rust'; pattern='^RustClient$' },
    @{ id='tarkov'; label='Escape from Tarkov'; pattern='^EscapeFromTarkov$' },
    @{ id='league'; label='League of Legends'; pattern='^League of Legends$' },
    @{ id='minecraft'; label='Minecraft'; pattern='^Minecraft.Windows$' },
    @{ id='game_silenthilltownfall'; label='Silent Hill: Townfall'; pattern='^(SilentHillTownfall-Win64-Shipping|Townfall-Win64-Shipping|SHTownfall|Silent Hill Townfall)$' }
  )
  $game = $null
  foreach ($rule in $rules) {
    $matched = @($processes | Where-Object { $_.ProcessName -match $rule.pattern } |
      Sort-Object WorkingSet64 -Descending | Select-Object -First 1)
    if ($matched.Count) {
      $game = $matched[0]
      $out.game_running = $true
      $out.game_id = $rule.id
      $out.game_label = $rule.label
      $out.game_process = "$($game.ProcessName).exe"
      $out.game_pid = [uint32]$game.Id
      # Text, not an array: Windows PowerShell 5.1 can serialize one-item arrays ambiguously.
      $out.game_processes_text = (@($processes | Where-Object { $_.ProcessName -match $rule.pattern } | ForEach-Object { "$($_.ProcessName).exe" } | Sort-Object -Unique) -join "`n")
      break
    }
  }
  if ($out.game_id -eq 'fivem') {
    $roots = [System.Collections.Generic.List[string]]::new()
    $roots.Add((Join-Path $env:LOCALAPPDATA 'FiveM\FiveM.app'))
    # Custom FiveM installs: derive from the running game, never a renderer path.
    try { if ($game.Path) { $roots.Add((Split-Path -Parent $game.Path)) } } catch {}
    $files = @($roots | Select-Object -Unique | ForEach-Object {
      foreach ($dir in @($_, (Join-Path $_ 'logs'))) {
        Get-ChildItem -LiteralPath $dir -Filter 'CitizenFX*.log' -File -ErrorAction SilentlyContinue
      }
    } | Sort-Object LastWriteTime -Descending | Select-Object -First 3)
    $sessionStart = $null
    try { $sessionStart = $game.StartTime.AddSeconds(-5) } catch {}
    foreach ($log in $files) {
      if ($sessionStart -and $log.LastWriteTime -lt $sessionStart) { continue }
      # Bound I/O even if a server produces a huge log; only read the last 256 KiB.
      $stream = [IO.File]::Open($log.FullName, 'Open', 'Read', 'ReadWrite')
      try {
        $null = $stream.Seek([math]::Max(0, $stream.Length - 262144), 'Begin')
        $reader = [IO.StreamReader]::new($stream)
        try { $tail = $reader.ReadToEnd() } finally { $reader.Dispose() }
      } finally { $stream.Dispose() }
      $events = @([regex]::Matches($tail, '(?im)^.*(?:Connecting to(?:\s+server)?[:\s]+[''"]?(?<target>(?:https?://)?(?:cfx\.re/join/)?[a-z0-9._:\-/]+)|Disconnected from server|Disconnecting from server|Connection closed|Disconnected by server|ERR_NET_DISCONNECT).*$') |
        Where-Object { -not $_.Groups['target'].Success -or $_.Groups['target'].Value -notmatch '^(?:server|to)\b' })
      if ($events.Count) {
        $last = $events[$events.Count - 1]
        if ($last.Groups['target'].Success) {
          $out.server_target = $last.Groups['target'].Value.TrimEnd('/', '.', "'", '"')
          $out.fivem_session_state = 'server'
          $out.server_evidence = 'Latest connection event in ' + $log.Name + '. In-server script menus are not exposed by this log.'
        } else {
          $out.fivem_session_state = 'main_menu'
          $out.server_evidence = 'Latest FiveM log event is a disconnect; FiveM is at its main menu or reconnecting.'
        }
        break
      }
    }
    if (-not $out.server_evidence) {
      $out.fivem_session_state = 'main_menu'
      $out.server_evidence = 'FiveM game process is running with no server connection this session (main menu).'
    }
  }
} catch { $issues.Add("Game/process detection unavailable: $($_.Exception.Message)") }
if ($issues.Count) { $out.telemetry_error = $issues -join '; ' }
$out.sampled_at_ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$out | ConvertTo-Json -Depth 4 -Compress
