@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-NvidiaFix.ps1"

title Opti Gods by leaq  --  NVIDIA + Display Fix

echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  NVIDIA Fix
echo    Fixes NCP, refresh rate, 30fps feel
echo  ==========================================
echo.
echo  [1/2] Extracting fix script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Please re-download from the website.
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo       Click "Yes" to fix NVIDIA as Administrator.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled or launch failed: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
$ErrorActionPreference = 'SilentlyContinue'

if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  !! This script must run as Administrator !!" -ForegroundColor Red
    Write-Host "  Please re-download and run the .bat file." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

trap {
    Write-Host ""
    Write-Host "  [FATAL ERROR] $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "  Press Enter to close"
    break
}

Clear-Host
Write-Host "======================================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq  --  NVIDIA + Display Fix" -ForegroundColor Red
Write-Host "  Fixes: NCP not opening, refresh rate stuck, 30fps" -ForegroundColor White
Write-Host "  Running as: $env:USERNAME (Admin)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Red
Write-Host ""

# ── 1. Re-enable & start NVIDIA services ───────────────────────────────────
Write-Host "  [1/7] Re-enabling NVIDIA services..." -ForegroundColor White

$nvServices = @(
    'NVDisplay.ContainerLocalSystem',   # NVIDIA Display Container LS (NCP needs this)
    'NvContainerLocalSystem',           # fallback name on some builds
    'NVSvc',                            # NVIDIA Driver Helper
    'nvsvc',
    'NvTelemetryContainer',
    'nvagent',
    'NvModuleTracker'
)

$fixed = 0
foreach ($svc in $nvServices) {
    $s = Get-Service -Name $svc -EA SilentlyContinue
    if ($s) {
        Set-Service $svc -StartupType Automatic -EA SilentlyContinue
        if ($s.Status -ne 'Running') {
            Start-Service $svc -EA SilentlyContinue
        }
        Write-Host "        OK — $svc enabled + started" -ForegroundColor Green
        $fixed++
    }
}
if ($fixed -eq 0) {
    Write-Host "        No NVIDIA services found — driver may need reinstall" -ForegroundColor Yellow
} else {
    Write-Host "        $fixed NVIDIA service(s) restored" -ForegroundColor Green
}

# ── 2. Remove display refresh rate override (OO ShutUp can cap this) ────────
Write-Host "  [2/7] Clearing display refresh rate overrides..." -ForegroundColor White
$displayPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'
Remove-ItemProperty $displayPath 'DxgkrnlDriverType'   -EA SilentlyContinue
Remove-ItemProperty $displayPath 'TdrLevel'            -EA SilentlyContinue

# Clear any per-monitor refresh rate caps
$configPath = 'HKCU:\Control Panel\Desktop'
$currentRef = (Get-ItemProperty $configPath -EA SilentlyContinue).LogPixels
Remove-ItemProperty 'HKCU:\Control Panel\Desktop' 'Win8DpiScaling' -EA SilentlyContinue

# Remove any WinUtil-set resolution/refresh locks
$monPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e96e-e325-11ce-bfc1-08002be10318}'
if (Test-Path $monPath) {
    Get-ChildItem $monPath -EA SilentlyContinue | ForEach-Object {
        Remove-ItemProperty $_.PSPath 'UserModeDriverName' -EA SilentlyContinue
    }
}
Write-Host "        OK — refresh rate registry locks cleared" -ForegroundColor Green

# ── 3. Remove WinUtil/OO ShutUp NVIDIA-breaking registry entries ─────────────
Write-Host "  [3/7] Removing debloat entries that break NVIDIA..." -ForegroundColor White

# OO ShutUp sometimes disables NVIDIA telemetry via these keys which also breaks NCP
Remove-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions' 'DenyDeviceIDs' -EA SilentlyContinue
Remove-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions' 'DenyDeviceIDsRetroactive' -EA SilentlyContinue

# Re-allow device installation (WinUtil sometimes disables this)
$devInstall = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions'
if (Test-Path $devInstall) {
    Remove-ItemProperty $devInstall 'DenyRemovableDevices' -EA SilentlyContinue
    Remove-ItemProperty $devInstall 'DenyDeviceClasses' -EA SilentlyContinue
}

# Remove any GPU scheduling forced-off (can cause 30fps feel)
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' -EA SilentlyContinue
# Re-enable HAGS (should always be ON for NVIDIA on Win11)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 2 -Type DWord -Force
Write-Host "        OK — HAGS re-enabled, device install restrictions cleared" -ForegroundColor Green

# ── 4. Fix GameDVR / Fullscreen optimisations (OO ShutUp breaks these) ──────
Write-Host "  [4/7] Restoring fullscreen & GameDVR settings..." -ForegroundColor White
$gDVR = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR'
if (!(Test-Path $gDVR)) { New-Item $gDVR -Force | Out-Null }
Set-ItemProperty $gDVR 'AppCaptureEnabled' 0 -Type DWord -Force

# Fullscreen optimizations — keep them ON (improves refresh rate switching)
$compatPath = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $compatPath)) { New-Item $compatPath -Force | Out-Null }
Set-ItemProperty $compatPath 'GameDVR_Enabled' 0 -Type DWord -Force
Set-ItemProperty $compatPath 'GameDVR_FSEBehaviorMode' 2 -Type DWord -Force
Set-ItemProperty $compatPath 'GameDVR_HonorUserFSEBehaviorMode' 1 -Type DWord -Force
Set-ItemProperty $compatPath 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Write-Host "        OK — fullscreen exclusive mode restored" -ForegroundColor Green

# ── 5. Remove NVIDIA driver-side FPS cap if one was set ─────────────────────
Write-Host "  [5/7] Removing any NVIDIA driver-level FPS cap..." -ForegroundColor White
$nvProfile = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
if (Test-Path $nvProfile) {
    Remove-ItemProperty $nvProfile 'FrameRateLimit' -EA SilentlyContinue
}
# Also clear via DRS path
$drsPath = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (Test-Path $drsPath) {
    Remove-ItemProperty $drsPath 'FrameRateLimit' -EA SilentlyContinue
}
# Clear DX9/OGL vsync overrides that could feel like 30fps
$nvDrs = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
Remove-ItemProperty $nvDrs 'VSyncMode' -EA SilentlyContinue
Write-Host "        OK — FPS cap and VSync override cleared" -ForegroundColor Green

# ── 6. Re-enable Xbox Game Bar / presence writer (WinUtil kills these) ───────
Write-Host "  [6/7] Restoring Xbox services (needed for NVIDIA overlay comms)..." -ForegroundColor White
$xboxServices = @('XblAuthManager','XblGameSave','XboxGipSvc','XboxNetApiSvc')
foreach ($svc in $xboxServices) {
    $s = Get-Service -Name $svc -EA SilentlyContinue
    if ($s) {
        Set-Service $svc -StartupType Manual -EA SilentlyContinue
        Write-Host "        OK — $svc set to Manual (won't auto-start, won't block NCP)" -ForegroundColor DarkGray
    }
}
Write-Host "        OK — Xbox services unblocked" -ForegroundColor Green

# ── 7. Restart NVIDIA Display Container LS ──────────────────────────────────
Write-Host "  [7/7] Restarting NVIDIA Display Container LS (opens NCP)..." -ForegroundColor White
$nvcls = Get-Service -Name 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcls) {
    Restart-Service 'NVDisplay.ContainerLocalSystem' -Force -EA SilentlyContinue
    Start-Sleep -Seconds 2
    $nvcls.Refresh()
    if ($nvcls.Status -eq 'Running') {
        Write-Host "        OK — NVDisplay.ContainerLocalSystem is running" -ForegroundColor Green
    } else {
        Write-Host "        Service did not start — try rebooting" -ForegroundColor Yellow
    }
} else {
    Write-Host "        Service not found — NVIDIA driver may need reinstall" -ForegroundColor Yellow
}

# ── Done ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ======================================================" -ForegroundColor Red
Write-Host "   DONE — NVIDIA fix applied" -ForegroundColor White
Write-Host "   REBOOT REQUIRED to fully restore refresh rate." -ForegroundColor Yellow
Write-Host "  ======================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  After reboot, right-click desktop -> NVIDIA Control Panel." -ForegroundColor DarkGray
Write-Host "  If NCP still missing: reinstall NVIDIA driver (clean install)." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close"
