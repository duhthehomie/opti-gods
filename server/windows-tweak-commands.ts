function buildDefenderExclusionCommand(): string {
  return String.raw`$ErrorActionPreference = 'Stop'
# Use the inbox Defender module explicitly; a NoProfile host may not have
# auto-loaded its commands. Never reinstall or enable a disabled antivirus.
$defenderModule = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules\Defender\Defender.psd1'
if (Test-Path -LiteralPath $defenderModule) {
  try { Import-Module -Name $defenderModule -ErrorAction Stop }
  catch { Write-Output "[SKIP] Microsoft Defender module could not load: $($_.Exception.Message). No exclusion was changed."; return }
}
$requiredCmdlets = @('Add-MpPreference','Get-MpPreference','Remove-MpPreference')
$missingCmdlets = @($requiredCmdlets | Where-Object { -not (Get-Command -Name $_ -ErrorAction Ignore) })
if ($missingCmdlets.Count -gt 0) { Write-Output "[SKIP] Microsoft Defender is unavailable or removed on this Windows installation: $($missingCmdlets -join ', '). No exclusion was changed. Install/restore Defender separately only if you intend to use it."; return }
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
        $errors += "$($setting.Name) (powercfg exit $($exitCode): $detail)"
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
        $errors += "activate SCHEME_CURRENT (powercfg exit $($activationExit): $detail)"
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
          $rollbackErrors += "$($setting.Name) restore (powercfg exit $($restoreExit): $detail)"
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

function buildOptiGods3500PlanCommand(): string {
  return String.raw`$ErrorActionPreference = 'Stop'
$plan = '6a93ec26-284d-4943-9fc4-c9616def55c6'
$template = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
$listing = & powercfg.exe /list 2>&1
if ($LASTEXITCODE -ne 0) { throw "Windows could not list power plans: $listing" }
if ([string]$listing -notmatch [regex]::Escape($plan)) {
  $existingPlan = @($listing | Where-Object { $_ -match '(?i)(Revision - Ultra Performance|Opti Gods Power Plan)' } | Select-Object -First 1)
  if ($existingPlan.Count -gt 0) {
    $match = [regex]::Match([string]$existingPlan[0], '[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}')
    if (-not $match.Success) { throw "Windows listed an Opti Gods power plan without a readable identifier: $($existingPlan[0])" }
    $plan = $match.Value
  } else {
    $created = & powercfg.exe /duplicatescheme $template $plan 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Windows could not create the Opti Gods Power Plan: $created" }
  }
}
$listing = & powercfg.exe /list 2>&1
if ($LASTEXITCODE -ne 0 -or [string]$listing -notmatch [regex]::Escape($plan)) {
  throw "Windows did not verify that the Opti Gods Power Plan is available."
}
$renamed = & powercfg.exe /changename $plan 'Opti Gods Power Plan' 'Opti Gods gaming plan; Ryzen Precision Boost manages CPU frequency.' 2>&1
if ($LASTEXITCODE -ne 0) { throw "Windows could not label the Opti Gods Power Plan: $renamed" }
$activated = & powercfg.exe /setactive $plan 2>&1
if ($LASTEXITCODE -ne 0) { throw "Windows could not activate the Opti Gods Power Plan: $activated" }
$active = & powercfg.exe /getactivescheme 2>&1
if ($LASTEXITCODE -ne 0 -or [string]$active -notmatch [regex]::Escape($plan)) {
  throw "Windows did not verify the Opti Gods Power Plan as active: $active"
}
Write-Host "[Ryzen 5 3500] Opti Gods Power Plan active and verified. CPU boost remains under AMD Precision Boost control." -ForegroundColor Green`;
}


export function buildSafeWindowsCommandOverride(id: string): string | undefined {
  if (id === "FiveM1650VRAMBudget") return String.raw`$ErrorActionPreference = 'Stop'
$dir = "$env:USERPROFILE\Documents\Rockstar Games\GTA V"
New-Item -Path $dir -ItemType Directory -Force | Out-Null
$path = Join-Path $dir 'commandline.txt'
$before = if (Test-Path -LiteralPath $path) { [string](Get-Content -LiteralPath $path -Raw -ErrorAction Stop) } else { '' }
$updated = [regex]::Replace($before, '(?i)(?<!\S)-availablevidmem\s+\S+', '').Trim()
$updated = [regex]::Replace($updated, '(?i)(?<!\S)-percentvidmem\s+\S+', '').Trim()
$updated = ($updated + ' -availablevidmem 4096 -percentvidmem 100').Trim()
Set-Content -LiteralPath $path -Value $updated -Encoding ASCII -ErrorAction Stop
$actual = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
if ($actual -notmatch '(?i)(?<!\S)-availablevidmem\s+4096(?:\s|$)' -or $actual -notmatch '(?i)(?<!\S)-percentvidmem\s+100(?:\s|$)') {
  Set-Content -LiteralPath $path -Value $before -Encoding ASCII -ErrorAction Stop
  throw 'The VRAM command-line values failed readback; the previous contents were restored.'
}
Write-Output '[VRAM] commandline.txt values written and read back: availablevidmem=4096, percentvidmem=100. Game consumption is not verified by this file check.'`;
  if (["SetHighPerformancePlan", "FiveM3500PerfPlan", "FiveM5600PowerPlan", "FiveMIntel14PowerPlan"].includes(id)) return buildOptiGods3500PlanCommand();
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
    $priorityPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.InstanceId)\Device Parameters\Interrupt Management\Affinity Policy"
    $oldPriority = Get-ItemPropertyValue -LiteralPath $priorityPath -Name 'DevicePriority' -ErrorAction Ignore
    try {
      Set-ItemProperty -LiteralPath $msiPath -Name 'MSISupported' -Value 1 -Type DWord -Force -ErrorAction Stop
      New-Item -Path $priorityPath -Force -ErrorAction Stop | Out-Null
      New-ItemProperty -LiteralPath $priorityPath -Name 'DevicePriority' -Value 3 -PropertyType DWord -Force -ErrorAction Stop | Out-Null
      if ((Get-ItemPropertyValue -LiteralPath $priorityPath -Name 'DevicePriority' -ErrorAction Stop) -ne 3) {
        throw 'Windows did not verify High priority for the NVIDIA adapter.'
      }
    $after = Get-ItemPropertyValue -LiteralPath $msiPath -Name 'MSISupported' -ErrorAction Stop
    if ($after -ne 1) { throw "Windows did not verify MSISupported=1 for the NVIDIA adapter." }
    } catch {
      $originalError = $_.Exception.Message
      try {
        Set-ItemProperty -LiteralPath $msiPath -Name 'MSISupported' -Value $before -Type DWord -Force -ErrorAction Stop
        if ($null -ne $oldPriority) {
          Set-ItemProperty -LiteralPath $priorityPath -Name 'DevicePriority' -Value $oldPriority -Type DWord -Force -ErrorAction Stop
        } else {
          Remove-ItemProperty -LiteralPath $priorityPath -Name 'DevicePriority' -ErrorAction Ignore
        }
      } catch { throw "NVIDIA MSI failed: $originalError. Rollback also failed: $($_.Exception.Message)" }
      throw "NVIDIA MSI failed and previous values were restored: $originalError"
    }
    Write-Host "[NVIDIA MSI] Verified MSI enabled and High priority only on $($gpu.FriendlyName). Other display adapters were ignored." -ForegroundColor Green`;
      }
      if (id === "CodDefenderExclusion") return buildDefenderExclusionCommand();
  if (id === "IntelOldGenPowerOpt" || id === "FiveM3500PerfPlan" || id === "Cod3500PowerPlan") return buildPowerPlanCommand(id);
  if (id === "DisableSearchIndexing") return buildSearchIndexerCommand();
  return undefined;
}
