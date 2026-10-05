function buildDefenderExclusionCommand(): string {
  return String.raw`$ErrorActionPreference = 'Stop'
$requiredCmdlets = @('Add-MpPreference','Get-MpPreference','Remove-MpPreference')
$missingCmdlets = @($requiredCmdlets | Where-Object { -not (Get-Command -Name $_ -ErrorAction SilentlyContinue) })
if ($missingCmdlets.Count -gt 0) { throw "Not for this system: Microsoft Defender command(s) unavailable: $($missingCmdlets -join ', '). No exclusion was changed." }
$candidatePaths = @('C:\Program Files\Call of Duty','C:\Program Files (x86)\Call of Duty','C:\Program Files\Battle.net Apps\Call of Duty','C:\Program Files (x86)\Steam\steamapps\common\Call of Duty Modern Warfare 2','D:\Call of Duty','D:\SteamLibrary\steamapps\common\Call of Duty Modern Warfare 2','E:\Call of Duty','E:\SteamLibrary\steamapps\common\Call of Duty Modern Warfare 2')
$found = @($candidatePaths | Where-Object { Test-Path -LiteralPath $_ })
if (-not $found.Count) { throw "Not for this system: Call of Duty installation folder was not found on the available drives. No exclusion was changed." }
try { $initialPreference = Get-MpPreference -ErrorAction Stop; $initialExclusions = @($initialPreference.ExclusionPath) }
catch { throw "Could not read Microsoft Defender exclusions: $($_.Exception.Message). No exclusion was changed." }
$added = @()
$errors = @()
foreach ($path in $found) {
  if ($initialExclusions -contains $path) { continue }
  try { Add-MpPreference -ExclusionPath $path -ErrorAction Stop; $added += $path }
  catch { $errors += "$path ($($_.Exception.Message))"; continue }
  try {
    $currentPreference = Get-MpPreference -ErrorAction Stop
    if (@($currentPreference.ExclusionPath) -notcontains $path) { $errors += "$path (Defender did not report the exclusion after adding it)" }
  } catch { $errors += "$path (verification failed: $($_.Exception.Message))" }
}
if ($errors.Count -gt 0) {
  $rollbackErrors = @()
  foreach ($path in $added) {
    try {
      Remove-MpPreference -ExclusionPath $path -ErrorAction Stop
      $afterRollback = Get-MpPreference -ErrorAction Stop
      if (@($afterRollback.ExclusionPath) -contains $path) { $rollbackErrors += "$path (Defender still reports the exclusion after rollback)" }
    } catch { $rollbackErrors += "$path ($($_.Exception.Message))" }
  }
  $rollbackMessage = if ($rollbackErrors.Count -gt 0) { " Rollback needs attention: $($rollbackErrors -join '; ')." } else { " Newly added exclusions were rolled back." }
  throw "Defender exclusions were not fully verified: $($errors -join '; ').$rollbackMessage"
}
Write-Host "[COD] Defender exclusions applied and verified for $($found.Count) detected Call of Duty folder(s)." -ForegroundColor Green`;
}

function buildPowerPlanCommand(id: string): string {
      const label = id === "IntelOldGenPowerOpt" ? "Intel 4th-8th Gen" : "Ryzen 5 3500";
      return String.raw`$ErrorActionPreference = 'Stop'
    $settings = @(
      @{ Name = 'PROCTHROTTLEMIN'; Value = 100 },
      @{ Name = 'PROCTHROTTLEMAX'; Value = 100 }
    )
    $originalValues = @{}
    foreach ($setting in $settings) {
      $query = & powercfg.exe /query SCHEME_CURRENT SUB_PROCESSOR $setting.Name 2>&1
      $queryExit = $LASTEXITCODE
      $queryText = [string]::Join(' ', @($query | ForEach-Object { "$_" }))
      if ($queryExit -ne 0 -or $queryText -notmatch '(?i)Current AC Power Setting Index:\s*0x([0-9a-f]+)') {
        throw "Not for this system: ${label} power settings unavailable on scheme SCHEME_CURRENT ($($setting.Name)); no values were changed. $queryText"
      }
      $originalValues[$setting.Name] = [Convert]::ToUInt32($matches[1], 16)
    }
    $errors = @()
    foreach ($setting in $settings) {
      $output = & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR $setting.Name $setting.Value 2>&1
      $exitCode = $LASTEXITCODE
      if ($exitCode -ne 0) {
        $detail = [string]::Join(' ', @($output | ForEach-Object { "$_" })).Trim()
        $errors += "$($setting.Name) (powercfg exit $exitCode: $detail)"
        continue
      }
      $check = & powercfg.exe /query SCHEME_CURRENT SUB_PROCESSOR $setting.Name 2>&1
      $checkExit = $LASTEXITCODE
      $checkText = [string]::Join(' ', @($check | ForEach-Object { "$_" }))
      if ($checkExit -ne 0 -or $checkText -notmatch '(?i)Current AC Power Setting Index:\s*0x([0-9a-f]+)') {
        $errors += "$($setting.Name) (read-back failed: $checkText)"
      } elseif ([Convert]::ToUInt32($matches[1], 16) -ne [uint32]$setting.Value) {
        $errors += "$($setting.Name) (verification expected $($setting.Value), read $($matches[1]))"
      }
    }
    if ($errors.Count -eq 0) {
      $activation = & powercfg.exe /setactive SCHEME_CURRENT 2>&1
      $activationExit = $LASTEXITCODE
      if ($activationExit -ne 0) {
        $detail = [string]::Join(' ', @($activation | ForEach-Object { "$_" })).Trim()
        $errors += "activate SCHEME_CURRENT (powercfg exit $activationExit: $detail)"
      }
    }
    if ($errors.Count -gt 0) {
      $rollbackErrors = @()
      foreach ($setting in $settings) {
        $previous = $originalValues[$setting.Name]
        $restore = & powercfg.exe /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR $setting.Name $previous 2>&1
        $restoreExit = $LASTEXITCODE
        if ($restoreExit -ne 0) {
          $detail = [string]::Join(' ', @($restore | ForEach-Object { "$_" })).Trim()
          $rollbackErrors += "$($setting.Name) restore (powercfg exit $restoreExit: $detail)"
          continue
        }
        $restoreCheck = & powercfg.exe /query SCHEME_CURRENT SUB_PROCESSOR $setting.Name 2>&1
        $restoreCheckExit = $LASTEXITCODE
        $restoreText = [string]::Join(' ', @($restoreCheck | ForEach-Object { "$_" }))
        if ($restoreCheckExit -ne 0 -or $restoreText -notmatch '(?i)Current AC Power Setting Index:\s*0x([0-9a-f]+)') {
          $rollbackErrors += "$($setting.Name) restore verification failed ($restoreText)"
        } elseif ([Convert]::ToUInt32($matches[1], 16) -ne [uint32]$previous) {
          $rollbackErrors += "$($setting.Name) restore verification failed (expected $previous, read $($matches[1]))"
        }
      }
      $restoreActive = & powercfg.exe /setactive SCHEME_CURRENT 2>&1
      $restoreActiveExit = $LASTEXITCODE
      if ($restoreActiveExit -ne 0) { $rollbackErrors += "active plan restore (powercfg exit $restoreActiveExit)" }
      $rollbackMessage = if ($rollbackErrors.Count -gt 0) { " Rollback needs attention: $($rollbackErrors -join '; ')." } else { " Original power values and active plan were restored." }
      throw "${label} power-plan operation failed: $($errors -join '; ').$rollbackMessage"
    }
    Write-Host "[${label}] processor limits applied to the existing active plan and verified." -ForegroundColor Green`;
    }

function buildSearchIndexerCommand(): string {
  return String.raw`$ErrorActionPreference = 'Stop'
$service = Get-Service -Name 'WSearch' -ErrorAction SilentlyContinue
if (-not $service) { throw "Not for this system: Windows Search (WSearch) is not installed; no service setting was changed." }
$initialService = Get-Service -Name 'WSearch' -ErrorAction Stop
$initialServiceState = $initialService.Status.ToString()
if ($initialServiceState -notin @('Running','Stopped')) {
  throw "Windows Search is currently $initialServiceState; wait for the service to settle and try again. No setting was changed."
}
$initialConfig = Get-CimInstance -ClassName Win32_Service -Filter "Name='WSearch'" -ErrorAction Stop
if (-not $initialConfig) { throw "Not for this system: Windows Search service configuration is unavailable; no service setting was changed." }
$initialStartMode = [string]$initialConfig.StartMode
$initiallyRunning = $initialServiceState -eq 'Running'
if ($initialStartMode -notin @('Auto','Manual','Disabled')) {
  throw "Windows Search has unsupported startup mode '$initialStartMode'; no service setting was changed."
}
if ($initialStartMode -eq 'Disabled' -and -not $initiallyRunning) {
  Write-Host "[OK] Windows Search is already disabled and verified." -ForegroundColor Green
  return
}
try {
  Set-Service -Name 'WSearch' -StartupType Disabled -ErrorAction Stop
  if ($initiallyRunning) {
    Stop-Service -Name 'WSearch' -Force -ErrorAction Stop
    $deadline = (Get-Date).AddSeconds(20)
    do {
      Start-Sleep -Milliseconds 250
      $currentState = (Get-Service -Name 'WSearch' -ErrorAction Stop).Status.ToString()
    } while ($currentState -ne 'Stopped' -and (Get-Date) -lt $deadline)
    if ($currentState -ne 'Stopped') { throw "WSearch did not stop within 20 seconds (current state: $currentState)." }
  }
  $verifiedService = Get-Service -Name 'WSearch' -ErrorAction Stop
  $verifiedConfig = Get-CimInstance -ClassName Win32_Service -Filter "Name='WSearch'" -ErrorAction Stop
  if ($verifiedService.Status -ne 'Stopped' -or $verifiedConfig.StartMode -ne 'Disabled') {
    throw "Windows did not confirm the requested state (startup: $($verifiedConfig.StartMode), service: $($verifiedService.Status))."
  }
  Write-Host "[OK] Windows Search indexing is disabled and verified. Re-enable it with the Windows Search Indexing Recovery fix." -ForegroundColor Green
} catch {
  $operationError = $_.Exception.Message
  $rollbackErrors = @()
  $restoreStartType = switch ($initialStartMode) {
    'Auto' { 'Automatic' }
    'Manual' { 'Manual' }
    'Disabled' { 'Disabled' }
    default { $null }
  }
  if ($null -eq $restoreStartType) {
    $rollbackErrors += "Original startup mode '$initialStartMode' is not supported by the recovery path"
  } else {
    try { Set-Service -Name 'WSearch' -StartupType $restoreStartType -ErrorAction Stop }
    catch { $rollbackErrors += "startup mode restore ($($_.Exception.Message))" }
    if ($initiallyRunning) {
      try {
        $restoredState = (Get-Service -Name 'WSearch' -ErrorAction Stop).Status.ToString()
        if ($restoredState -ne 'Running') {
          Start-Service -Name 'WSearch' -ErrorAction Stop
          $deadline = (Get-Date).AddSeconds(20)
          do {
            Start-Sleep -Milliseconds 250
            $restoredState = (Get-Service -Name 'WSearch' -ErrorAction Stop).Status.ToString()
          } while ($restoredState -ne 'Running' -and (Get-Date) -lt $deadline)
        }
        if ($restoredState -ne 'Running') { $rollbackErrors += "original running state was not restored (current state: $restoredState)" }
      } catch { $rollbackErrors += "running state restore ($($_.Exception.Message))" }
    }
    try {
      $restoredService = Get-Service -Name 'WSearch' -ErrorAction Stop
      $restoredConfig = Get-CimInstance -ClassName Win32_Service -Filter "Name='WSearch'" -ErrorAction Stop
      if ($restoredConfig.StartMode -ne $initialStartMode) { $rollbackErrors += "startup verification expected $initialStartMode, read $($restoredConfig.StartMode)" }
      if ($initiallyRunning -and $restoredService.Status -ne 'Running') { $rollbackErrors += "running-state verification read $($restoredService.Status)" }
      if (-not $initiallyRunning -and $restoredService.Status -ne 'Stopped') { $rollbackErrors += "stopped-state verification read $($restoredService.Status)" }
    } catch { $rollbackErrors += "state verification ($($_.Exception.Message))" }
  }
  $rollbackMessage = if ($rollbackErrors.Count -gt 0) { " Rollback needs attention: $($rollbackErrors -join '; ')." } else { " Original WSearch startup mode and state were restored." }
  throw "Windows Search was not disabled: $operationError.$rollbackMessage"
}`;
}

export function buildSafeWindowsCommandOverride(id: string): string | undefined {
  if (id === "EnableNvidiaMSIPro") {
        return String.raw`$active = @(Get-PnpDevice -Class Display -ErrorAction Stop | Where-Object { $_.Status -eq 'OK' })
    $nvidia = @($active | Where-Object { $_.FriendlyName -match '(?i)NVIDIA' -and $_.InstanceId -match '(?i)^PCI\\VEN_10DE&' })
    if ($nvidia.Count -ne 1) {
      $names = @($active | ForEach-Object { $_.FriendlyName }) -join ', '
      throw "Not for this system: NVIDIA MSI requires exactly one active PCI NVIDIA display adapter; detected $($nvidia.Count). Active displays: $names. No registry values were changed."
    }
    $gpu = $nvidia[0]
    $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (!(Test-Path -LiteralPath $msiPath)) { throw "Windows did not expose an MSI capability path for the NVIDIA adapter ($($gpu.FriendlyName)). No registry values were changed." }
    $before = Get-ItemPropertyValue -LiteralPath $msiPath -Name 'MSISupported' -ErrorAction Stop
    if ($before -notin @(0,1)) { throw "The NVIDIA adapter has an unsupported MSISupported value ($before). No registry values were changed." }
    Set-ItemProperty -LiteralPath $msiPath -Name 'MSISupported' -Value 1 -Type DWord -Force -ErrorAction Stop
    $after = Get-ItemPropertyValue -LiteralPath $msiPath -Name 'MSISupported' -ErrorAction Stop
    if ($after -ne 1) { throw "Windows did not verify MSISupported=1 for the NVIDIA adapter." }
    Write-Host "[NVIDIA MSI] Enabled MSISupported=1 only on $($gpu.FriendlyName). Other display adapters were ignored." -ForegroundColor Green`;
      }
      if (id === "CodDefenderExclusion") return buildDefenderExclusionCommand();
  if (id === "IntelOldGenPowerOpt" || id === "FiveM3500PerfPlan" || id === "Cod3500PowerPlan") return buildPowerPlanCommand(id);
  if (id === "DisableSearchIndexing") return buildSearchIndexerCommand();
  return undefined;
}
