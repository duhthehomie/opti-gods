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
  const names = id === "IntelOldGenPowerOpt"
    ? ["PROCTHROTTLEMIN", "PROCTHROTTLEMAX", "PERFBOOSTMODE", "PERFBOOSTPOL"]
    // Ryzen 3000 firmware exposes different PERFBOOSTMODE ranges. Keep this
    // plan to the two processor-throttle values consistently supported by
    // Windows so an OEM power scheme cannot reject the whole change.
    : ["PROCTHROTTLEMIN", "PROCTHROTTLEMAX"];
  const values = id === "IntelOldGenPowerOpt" ? [100, 100, 2, 100] : [100, 100];
  const settingIds: Record<string, string> = {
    PROCTHROTTLEMIN: "893dee8e-2bef-41e0-89c6-b55d0929964c",
    PROCTHROTTLEMAX: "bc5038f7-23e0-4960-96da-33abaf5935ec",
    PERFBOOSTMODE: "be337238-0d82-4146-a960-4f3749d470c7",
    PERFBOOSTPOL: "45bcc044-d885-43e2-8605-ee0ec6e96b59",
    CPMINCORES: "0cc5b647-c1df-4637-891a-dec35c318583",
  };
  const definitions = names
    .map((name, index) => `@{ Name = '${name}'; Guid = '${settingIds[name]}'; Value = ${values[index]} }`)
    .join(", ");

  return String.raw`$ErrorActionPreference = 'Stop'
$subgroup = '54533251-82be-4824-96c1-47b60b740d00'
$settingsRoot = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes'
$settings = @(${definitions})
$activeOutput = & powercfg.exe /getactivescheme 2>&1
$activeExit = $LASTEXITCODE
$activeText = [string]::Join(' ', @($activeOutput | ForEach-Object { "$_" }))
if ($activeExit -ne 0 -or $activeText -notmatch '(?i)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') {
  throw "${label}: could not identify the active Windows power scheme (exit $activeExit). $activeText"
}
$originalScheme = $matches[1]
$preferredScheme = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
function Get-MissingPowerSettings([string]$candidate) {
  $unavailable = @()
  foreach ($setting in $settings) {
    $null = & powercfg.exe /query $candidate $subgroup $setting.Guid 2>&1
    if ($LASTEXITCODE -ne 0) { $unavailable += $setting.Name }
  }
  return $unavailable
}
$scheme = $preferredScheme
$missing = @(Get-MissingPowerSettings $scheme)
if ($missing.Count -gt 0 -and $scheme -ne $originalScheme) {
  $scheme = $originalScheme
  $missing = @(Get-MissingPowerSettings $scheme)
}
if ($missing.Count -gt 0) {
  throw "Not for this system: ${label} power settings unavailable on scheme $($scheme): $($missing -join ', '). No power values were changed."
}
$originalValues = @{}
foreach ($setting in $settings) {
  $path = "$settingsRoot\$scheme\$subgroup\$($setting.Guid)"
  $hadValue = $false
  $oldValue = $null
  if (Test-Path -LiteralPath $path) {
    $properties = Get-ItemProperty -LiteralPath $path -ErrorAction Stop
    if ($properties.PSObject.Properties.Name -contains 'ACSettingIndex') {
      $hadValue = $true
      $oldValue = [uint32]$properties.ACSettingIndex
    }
  }
  $originalValues[$setting.Guid] = @{ Path = $path; Exists = $hadValue; Value = $oldValue }
}
$errors = @()
foreach ($setting in $settings) {
  try {
    $output = & powercfg.exe /setacvalueindex $scheme $subgroup $setting.Guid $setting.Value 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      $detail = [string]::Join(' ', @($output | ForEach-Object { "$_" })).Trim()
      $errors += "$($setting.Name) (powercfg exit $($exitCode): $detail)"
      continue
    }
    $actual = Get-ItemPropertyValue -LiteralPath $originalValues[$setting.Guid].Path -Name 'ACSettingIndex' -ErrorAction Stop
    if ([uint32]$actual -ne [uint32]$setting.Value) { $errors += "$($setting.Name) (verification expected $($setting.Value), read $actual)" }
  } catch { $errors += "$($setting.Name) ($($_.Exception.Message))" }
}
if ($errors.Count -eq 0) {
  $activationOutput = & powercfg.exe /setactive $scheme 2>&1
  $activationExit = $LASTEXITCODE
  if ($activationExit -ne 0) {
    $detail = [string]::Join(' ', @($activationOutput | ForEach-Object { "$_" })).Trim()
    $errors += "activate plan $scheme (powercfg exit $($activationExit): $detail)"
  } else {
    $activeAfterOutput = & powercfg.exe /getactivescheme 2>&1
    $activeAfterExit = $LASTEXITCODE
    $activeAfterText = [string]::Join(' ', @($activeAfterOutput | ForEach-Object { "$_" }))
    if ($activeAfterExit -ne 0 -or $activeAfterText -notmatch "(?i)$([regex]::Escape($scheme))") {
      $errors += "activate plan $scheme (active plan verification failed: $activeAfterText)"
    }
  }
}
if ($errors.Count -gt 0) {
  $rollbackErrors = @()
  foreach ($setting in $settings) {
    $snapshot = $originalValues[$setting.Guid]
    try {
      if ($snapshot.Exists) {
        $rollbackOutput = & powercfg.exe /setacvalueindex $scheme $subgroup $setting.Guid $snapshot.Value 2>&1
        $rollbackExit = $LASTEXITCODE
        if ($rollbackExit -ne 0) {
          $detail = [string]::Join(' ', @($rollbackOutput | ForEach-Object { "$_" })).Trim()
          $rollbackErrors += "$($setting.Name) restore (powercfg exit $($rollbackExit): $detail)"
        } else {
          $restored = Get-ItemPropertyValue -LiteralPath $snapshot.Path -Name 'ACSettingIndex' -ErrorAction Stop
          if ([uint32]$restored -ne [uint32]$snapshot.Value) { $rollbackErrors += "$($setting.Name) restore verification failed (expected $($snapshot.Value), read $restored)" }
        }
      } elseif (Test-Path -LiteralPath $snapshot.Path) {
        $afterProperties = Get-ItemProperty -LiteralPath $snapshot.Path -ErrorAction Stop
        if ($afterProperties.PSObject.Properties.Name -contains 'ACSettingIndex') {
          Remove-ItemProperty -LiteralPath $snapshot.Path -Name 'ACSettingIndex' -ErrorAction Stop
          $confirmedProperties = Get-ItemProperty -LiteralPath $snapshot.Path -ErrorAction Stop
          if ($confirmedProperties.PSObject.Properties.Name -contains 'ACSettingIndex') { $rollbackErrors += "$($setting.Name) restore verification failed (new value remains)" }
        }
      }
    } catch { $rollbackErrors += "$($setting.Name) restore ($($_.Exception.Message))" }
  }
  $restoreOutput = & powercfg.exe /setactive $originalScheme 2>&1
  $restoreExit = $LASTEXITCODE
  if ($restoreExit -ne 0) {
    $detail = [string]::Join(' ', @($restoreOutput | ForEach-Object { "$_" })).Trim()
    $rollbackErrors += "restore active plan $originalScheme (powercfg exit $($restoreExit): $detail)"
  } else {
    $restoredActiveOutput = & powercfg.exe /getactivescheme 2>&1
    $restoredActiveExit = $LASTEXITCODE
    $restoredActiveText = [string]::Join(' ', @($restoredActiveOutput | ForEach-Object { "$_" }))
    if ($restoredActiveExit -ne 0 -or $restoredActiveText -notmatch "(?i)$([regex]::Escape($originalScheme))") {
      $rollbackErrors += "restore active plan $originalScheme (verification failed: $restoredActiveText)"
    }
  }
  $rollbackMessage = if ($rollbackErrors.Count -gt 0) { " Rollback needs attention: $($rollbackErrors -join '; ')." } else { " Original power values and active plan were restored." }
  throw "${label} power-plan operation failed: $($errors -join '; ').$rollbackMessage"
}
Write-Host "[${label}] power-plan settings applied and verified on scheme $scheme." -ForegroundColor Green`;
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
    return String.raw`$active = @(Get-PnpDevice -Class Display -ErrorAction Stop | Where-Object { $_.Status -eq 'OK' }); $nvidia = @($active | Where-Object { $_.FriendlyName -match '(?i)NVIDIA' }); if ($active.Count -ne 1) { $names = @($active | ForEach-Object { $_.FriendlyName }) -join ', '; throw "Not for this system: NVIDIA MSI requires exactly one active display adapter; detected $($active.Count) ($names). No registry values were changed." }; if ($nvidia.Count -ne 1) { throw "Not for this system: NVIDIA MSI requires exactly one active NVIDIA display adapter; the active adapter is not NVIDIA or the topology is ambiguous. No registry values were changed." }; $gpu = $nvidia[0]; $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"; if (!(Test-Path -LiteralPath $msiPath)) { throw "Windows did not expose an MSI capability path for the detected NVIDIA adapter ($($gpu.FriendlyName)). No registry values were changed." }; $before = Get-ItemPropertyValue -LiteralPath $msiPath -Name 'MSISupported' -ErrorAction Stop; if ($before -notin @(0,1)) { throw "The detected NVIDIA adapter has an unsupported MSISupported value ($before). No registry values were changed." }; Set-ItemProperty -LiteralPath $msiPath -Name 'MSISupported' -Value 1 -Type DWord -Force -ErrorAction Stop; $after = Get-ItemPropertyValue -LiteralPath $msiPath -Name 'MSISupported' -ErrorAction Stop; if ($after -ne 1) { throw "Windows did not verify MSISupported=1 for the detected NVIDIA adapter." }; Write-Host "[NVIDIA MSI] Enabled MSISupported=1 only on $($gpu.FriendlyName). NICs, NVMe devices, affinity, and priority were not changed." -ForegroundColor Green`;
  }
  if (id === "CodDefenderExclusion") return buildDefenderExclusionCommand();
  if (id === "IntelOldGenPowerOpt" || id === "FiveM3500PerfPlan") return buildPowerPlanCommand(id);
  if (id === "DisableSearchIndexing") return buildSearchIndexerCommand();
  return undefined;
}
