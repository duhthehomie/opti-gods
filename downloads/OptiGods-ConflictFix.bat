@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-ConflictFix.ps1"

title Opti Gods by leaq  --  Stacked Optimizer Conflict Fix

echo.
echo  ================================================
echo    OPTI GODS by leaq  --  Conflict Fix
echo    Repairs damage from stacked optimizer tools
echo    (WinUtil, OO ShutUp, Optimizer, etc.)
echo  ================================================
echo.
echo  [1/2] Extracting script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Please re-download.
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo       Click "Yes" to run as Administrator.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled or launch failed: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
$ErrorActionPreference = 'SilentlyContinue'

if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  !! Must run as Administrator !!" -ForegroundColor Red
    Read-Host "  Press Enter to close"
    exit 1
}

trap {
    Write-Host ""
    Write-Host "  [ERROR] $_" -ForegroundColor Red
    Read-Host "  Press Enter to close"
    break
}

Clear-Host
Write-Host "================================================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq  --  Stacked Optimizer Conflict Fix" -ForegroundColor Red
Write-Host "  Diagnoses + repairs damage from WinUtil / OO ShutUp /" -ForegroundColor White
Write-Host "  Chris Titus / Optimizer / Any other optimizer tool." -ForegroundColor White
Write-Host "  Running as: $env:USERNAME  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Red
Write-Host ""

# ────────────────────────────────────────────────────────────────────────────
# PHASE 1 — DETECT what other optimizer tools have been run
# ────────────────────────────────────────────────────────────────────────────
Write-Host "  PHASE 1 — Scanning for other optimizer tools..." -ForegroundColor Red
Write-Host ""

$detected = @()

# WinUtil (Chris Titus Tech)
$wuPath = "$env:TEMP\WinUtil*"
$wuReg  = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -EA SilentlyContinue).WinUtil
$wuFile = Test-Path "$env:USERPROFILE\Desktop\winutil*"
if ($wuReg -or $wuFile -or (Get-ChildItem $env:TEMP -Filter 'WinUtil*' -EA SilentlyContinue)) {
    $detected += "WinUtil (Chris Titus Tech)"
    Write-Host "  [FOUND] WinUtil / Chris Titus Tech optimizer" -ForegroundColor Yellow
}

# OO ShutUp 10/11
$ooExe  = (Get-Process -Name 'OOSU10' -EA SilentlyContinue) -or (Test-Path "$env:PROGRAMFILES\OO Software\ShutUp10\OOSU10.exe")
$ooRun  = Test-Path "$env:APPDATA\OO Software"
if ($ooExe -or $ooRun) {
    $detected += "OO ShutUp 10/11"
    Write-Host "  [FOUND] OO ShutUp 10 / ShutUp 11" -ForegroundColor Yellow
}

# Optimizer (hellzerg)
if (Test-Path "$env:LOCALAPPDATA\Optimizer") {
    $detected += "Optimizer (hellzerg)"
    Write-Host "  [FOUND] Optimizer by hellzerg" -ForegroundColor Yellow
}

# Autoruns / BCUninstaller artifacts
if (Test-Path "$env:PROGRAMFILES\BCUninstaller") {
    $detected += "BCUninstaller"
    Write-Host "  [FOUND] BCUninstaller" -ForegroundColor Yellow
}

# ReviOS / AtlasOS — check for custom AME Wizard playbook artifacts
if ((Test-Path 'C:\Windows\AME') -or (Test-Path "$env:SYSTEMROOT\Setup\Scripts\AME*")) {
    $detected += "AME Wizard / AtlasOS / ReviOS"
    Write-Host "  [FOUND] AME Wizard / AtlasOS / ReviOS" -ForegroundColor Red
    Write-Host "         WARNING: AtlasOS/ReviOS cannot be fully undone without reinstall" -ForegroundColor Red
}

# NSudo / RunAsTrustedInstaller scripts
if (Test-Path "$env:PROGRAMFILES\NSudo") {
    $detected += "NSudo"
    Write-Host "  [FOUND] NSudo" -ForegroundColor Yellow
}

# Generic: check if NVIDIA services are disabled (sure sign another tool ran)
$nvcls = Get-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcls -and $nvcls.StartType -eq 'Disabled') {
    Write-Host "  [FOUND] NVDisplay.ContainerLocalSystem is DISABLED — another optimizer did this" -ForegroundColor Red
    $detected += "Unknown optimizer (disabled NVIDIA services)"
}

if ($detected.Count -eq 0) {
    Write-Host "  No other optimizer tools detected on this system." -ForegroundColor DarkGray
    Write-Host "  Proceeding with full NVIDIA + display repair anyway." -ForegroundColor DarkGray
} else {
    Write-Host ""
    Write-Host "  $($detected.Count) tool(s) found that can conflict with Opti Gods:" -ForegroundColor Yellow
    $detected | ForEach-Object { Write-Host "    -> $_" -ForegroundColor Yellow }
}
Write-Host ""

# ────────────────────────────────────────────────────────────────────────────
# PHASE 2 — NUCLEAR NVIDIA SERVICE RESTORE
# ────────────────────────────────────────────────────────────────────────────
Write-Host "  PHASE 2 — Restoring ALL NVIDIA services..." -ForegroundColor Red
Write-Host ""

$allNvServices = @{
    'NVDisplay.ContainerLocalSystem' = 'Automatic'  # NVIDIA Display Container LS — NCP needs this
    'NvContainerLocalSystem'         = 'Automatic'  # Alt name on some driver versions
    'NVSvc'                          = 'Automatic'  # NVIDIA Driver Helper Service
    'nvsvc'                          = 'Automatic'
    'NvTelemetryContainer'           = 'Automatic'  # NVIDIA Telemetry Container
    'nvagent'                        = 'Manual'     # NVIDIA Network Service
    'NvModuleTracker'                = 'Manual'     # NVIDIA Module Tracker
    'NvContainerNetworkService'      = 'Automatic'
    'NVDisplay'                      = 'Manual'
}

$restoredCount = 0
foreach ($kv in $allNvServices.GetEnumerator()) {
    $svc = Get-Service -Name $kv.Key -EA SilentlyContinue
    if ($svc) {
        $startType = if ($kv.Value -eq 'Automatic') { 'Automatic' } else { 'Manual' }
        Set-Service $kv.Key -StartupType $startType -EA SilentlyContinue
        if ($svc.Status -ne 'Running' -and $kv.Value -eq 'Automatic') {
            Start-Service $kv.Key -EA SilentlyContinue
        }
        $svc.Refresh()
        Write-Host "    $($kv.Key): $startType — Status: $($svc.Status)" -ForegroundColor Green
        $restoredCount++
    }
}

# Also fix NVIDIA via sc.exe as backup (in case Set-Service is blocked by policy)
$scFix = @('NVDisplay.ContainerLocalSystem','NvTelemetryContainer','NVSvc')
foreach ($s in $scFix) {
    & sc.exe config $s start= auto 2>$null | Out-Null
    & sc.exe start  $s           2>$null | Out-Null
}

Write-Host ""
Write-Host "    $restoredCount NVIDIA service(s) processed" -ForegroundColor Cyan

# ────────────────────────────────────────────────────────────────────────────
# PHASE 3 — FULL DISPLAY SUBSYSTEM RESET
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  PHASE 3 — Resetting display subsystem..." -ForegroundColor Red
Write-Host ""

$gfxDrivers = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'

# Remove TDR manipulations (can cause driver restarts + 30fps feel)
Remove-ItemProperty $gfxDrivers 'TdrLevel'        -EA SilentlyContinue
Remove-ItemProperty $gfxDrivers 'TdrDelay'        -EA SilentlyContinue
Remove-ItemProperty $gfxDrivers 'TdrDdiDelay'     -EA SilentlyContinue
# Restore safe TDR defaults
Set-ItemProperty $gfxDrivers 'TdrLevel' 3  -Type DWord -Force
Set-ItemProperty $gfxDrivers 'TdrDelay' 8  -Type DWord -Force
Write-Host "    TDR reset to safe defaults (Level=3, Delay=8s)" -ForegroundColor Green

# Re-enable HAGS (Hardware Accelerated GPU Scheduling) — always ON for NVIDIA Win11
Set-ItemProperty $gfxDrivers 'HwSchMode' 2 -Type DWord -Force
Write-Host "    HAGS re-enabled (HwSchMode=2)" -ForegroundColor Green

# Remove any display mode locks (refresh rate cap, resolution lock)
Remove-ItemProperty $gfxDrivers 'DxgkrnlDriverType' -EA SilentlyContinue
Write-Host "    DxgkrnlDriverType override removed" -ForegroundColor Green

# Clear NVIDIA driver-level FPS cap from ALL known paths
$fpsPaths = @(
    'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak',
    'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak',
    'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
)
foreach ($p in $fpsPaths) {
    if (Test-Path $p) {
        Remove-ItemProperty $p 'FrameRateLimit'   -EA SilentlyContinue
        Remove-ItemProperty $p 'VSyncMode'        -EA SilentlyContinue
        Remove-ItemProperty $p 'PowerMizerEnable' -EA SilentlyContinue
        Write-Host "    FPS cap / VSync override cleared: $p" -ForegroundColor Green
    }
}

# Clear per-monitor caps in Display adapter class keys
$dispClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e96e-e325-11ce-bfc1-08002be10318}'
if (Test-Path $dispClass) {
    Get-ChildItem $dispClass -EA SilentlyContinue | ForEach-Object {
        $desc = (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc
        if ($desc -match 'NVIDIA') {
            Remove-ItemProperty $_.PSPath 'FrameRateLimit'           -EA SilentlyContinue
            Remove-ItemProperty $_.PSPath 'Display1_DownScalingSupported' -EA SilentlyContinue
            Write-Host "    NVIDIA adapter key cleaned: $desc" -ForegroundColor Green
        }
    }
}

# ────────────────────────────────────────────────────────────────────────────
# PHASE 4 — REMOVE POLICY LOCKS OTHER TOOLS SET
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  PHASE 4 — Removing optimizer policy locks..." -ForegroundColor Red
Write-Host ""

# Device install restrictions (OO ShutUp sets these — prevents NVIDIA driver updates)
$devRestrict = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'
if (Test-Path $devRestrict) {
    Remove-ItemProperty $devRestrict 'DenyDeviceIDs'           -EA SilentlyContinue
    Remove-ItemProperty $devRestrict 'DenyDeviceIDsRetroactive'-EA SilentlyContinue
    Remove-ItemProperty $devRestrict 'DenyDeviceClasses'       -EA SilentlyContinue
    Remove-ItemProperty $devRestrict 'DenyRemovableDevices'    -EA SilentlyContinue
    Write-Host "    Device install restrictions cleared" -ForegroundColor Green
}

# Windows Update driver delivery (OO ShutUp blocks this)
$wuPolicy = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
if (Test-Path $wuPolicy) {
    Remove-ItemProperty $wuPolicy 'ExcludeWUDriversInQualityUpdate' -EA SilentlyContinue
    Write-Host "    Windows Update driver delivery unblocked" -ForegroundColor Green
}

# Remove display scaling policy locks
Remove-ItemProperty 'HKCU:\Control Panel\Desktop' 'Win8DpiScaling' -EA SilentlyContinue
Remove-ItemProperty 'HKCU:\Control Panel\Desktop' 'LogPixels'      -EA SilentlyContinue

# WinUtil sometimes sets these — kill them
Remove-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'EnableLUA' -EA SilentlyContinue
Write-Host "    Scaling + display policy locks removed" -ForegroundColor Green

# ────────────────────────────────────────────────────────────────────────────
# PHASE 5 — FULLSCREEN & GAMEDVR (stacking tools invert each other here)
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  PHASE 5 — Fixing fullscreen optimizations & GameDVR..." -ForegroundColor Red
Write-Host ""

$gcs = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $gcs)) { New-Item $gcs -Force | Out-Null }
# Fullscreen exclusive mode — keep ON so games switch refresh rate properly
Set-ItemProperty $gcs 'GameDVR_Enabled'                          0 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_FSEBehaviorMode'                  2 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_HonorUserFSEBehaviorMode'         1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_DXGIHonorFSEWindowsCompatible'   1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_EFSEFeatureFlags'                 0 -Type DWord -Force
Write-Host "    GameDVR off, FSE mode restored" -ForegroundColor Green

# ────────────────────────────────────────────────────────────────────────────
# PHASE 6 — POWER PLAN (stacking tools can set conflicting power plans)
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  PHASE 6 — Setting power plan to High Performance..." -ForegroundColor Red
Write-Host ""

# List current plans
$plans = & powercfg /list 2>$null
Write-Host "    Current power plans:" -ForegroundColor DarkGray
$plans | Where-Object { $_ -match 'GUID' } | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }

# Activate High Performance
$hpGuid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
& powercfg /setactive $hpGuid 2>$null

# Verify
$active = (& powercfg /getactivescheme 2>$null)
Write-Host "    Active plan: $active" -ForegroundColor Green

# Reset CPU min/max to sane gaming values
& powercfg /setacvalueindex $hpGuid sub_processor PROCTHROTTLEMIN 100 2>$null
& powercfg /setacvalueindex $hpGuid sub_processor PROCTHROTTLEMAX 100 2>$null
& powercfg /setactive $hpGuid 2>$null
Write-Host "    CPU min/max performance = 100% (no throttle)" -ForegroundColor Green

# ────────────────────────────────────────────────────────────────────────────
# PHASE 7 — XBOX + DISPLAY SERVICES (WinUtil kills these)
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  PHASE 7 — Restoring display & Xbox services..." -ForegroundColor Red
Write-Host ""

$criticalServices = @{
    'XblAuthManager'        = 'Manual'
    'XblGameSave'           = 'Manual'
    'XboxGipSvc'            = 'Manual'
    'XboxNetApiSvc'         = 'Manual'
    'DPS'                   = 'Automatic'   # Diagnostic Policy — some tools kill this
    'WSearch'               = 'Automatic'   # not critical but some tools break display via this
    'Winmgmt'               = 'Automatic'   # WMI — NVIDIA Container uses this
    'RpcSs'                 = 'Automatic'   # RPC — if this is disabled the whole system is broken
}

foreach ($kv in $criticalServices.GetEnumerator()) {
    $svc = Get-Service -Name $kv.Key -EA SilentlyContinue
    if ($svc) {
        if ($svc.StartType -eq 'Disabled') {
            Set-Service $kv.Key -StartupType $kv.Value -EA SilentlyContinue
            Write-Host "    $($kv.Key): was DISABLED — set to $($kv.Value)" -ForegroundColor Yellow
        } else {
            Write-Host "    $($kv.Key): OK ($($svc.StartType))" -ForegroundColor DarkGray
        }
    }
}

# ────────────────────────────────────────────────────────────────────────────
# PHASE 8 — FINAL NVIDIA CONTAINER RESTART + NVCPLUI REGISTRATION
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  PHASE 8 — Final NVIDIA restart + NCP registration..." -ForegroundColor Red
Write-Host ""

# Force restart NVIDIA Display Container LS
& sc.exe stop  'NVDisplay.ContainerLocalSystem' 2>$null | Out-Null
Start-Sleep -Seconds 2
& sc.exe start 'NVDisplay.ContainerLocalSystem' 2>$null | Out-Null
Start-Sleep -Seconds 3

$nvcls = Get-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcls) {
    $nvcls.Refresh()
    $color = if ($nvcls.Status -eq 'Running') { 'Green' } else { 'Yellow' }
    Write-Host "    NVDisplay.ContainerLocalSystem: $($nvcls.Status)" -ForegroundColor $color
}

# Re-register NVIDIA Control Panel App with Windows
$ncpPaths = @(
    "$env:PROGRAMFILES\NVIDIA Corporation\Control Panel Client\nvcplui.exe",
    "$env:SystemRoot\System32\nvcplui.exe"
)
$ncpFound = $false
foreach ($p in $ncpPaths) {
    if (Test-Path $p) {
        Write-Host "    NCP found at: $p" -ForegroundColor Green
        # Re-register shell extension
        & regsvr32.exe /s "$env:SystemRoot\System32\nvshext.dll" 2>$null
        Write-Host "    NVIDIA shell extension re-registered" -ForegroundColor Green
        $ncpFound = $true
        break
    }
}
if (!$ncpFound) {
    Write-Host "    NCP executable not found — driver reinstall required" -ForegroundColor Yellow
    Write-Host "    Use DDU (Display Driver Uninstaller) then reinstall from nvidia.com" -ForegroundColor Yellow
}

# ────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Red
Write-Host "  DONE — Stacked Optimizer Conflict Fix complete" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Red
Write-Host ""

if ($detected.Count -gt 0) {
    Write-Host "  Other optimizer tools found on this PC:" -ForegroundColor Yellow
    $detected | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "  These tools ran settings that conflict with each other." -ForegroundColor White
    Write-Host "  Opti Gods does NOT disable NVIDIA services or cap refresh" -ForegroundColor White
    Write-Host "  rate — those changes came from the tools listed above." -ForegroundColor White
} else {
    Write-Host "  No other optimizer tools detected." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  REQUIRED: REBOOT YOUR PC NOW." -ForegroundColor Red
Write-Host ""
Write-Host "  After reboot:" -ForegroundColor White
Write-Host "    1. Right-click desktop -> NVIDIA Control Panel" -ForegroundColor DarkGray
Write-Host "    2. Check Display -> Change resolution -> verify Hz" -ForegroundColor DarkGray
Write-Host "    3. If NCP still missing, run DDU + clean driver install" -ForegroundColor DarkGray
Write-Host "       DDU: https://www.wagnardsoft.com" -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close (then REBOOT)"
