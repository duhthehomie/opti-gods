@echo off
setlocal EnableDelayedExpansion

:: ── Self-elevate without PowerShell (works even when PS is blocked) ──────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Set oShell = CreateObject("Shell.Application") > "%temp%\og_elev.vbs"
    echo oShell.ShellExecute "%~f0", "", "", "runas", 1 >> "%temp%\og_elev.vbs"
    cscript //nologo "%temp%\og_elev.vbs"
    del "%temp%\og_elev.vbs" >nul 2>&1
    exit /b
)

:: ── Admin confirmed ──────────────────────────────────────────────────────────
title Opti Gods NVIDIA Fix  [RUNNING AS ADMIN]
color 4F
set "LOG=%USERPROFILE%\Desktop\OptiGods-Fix-Log.txt"

echo ============================================================ > "%LOG%"
echo   OPTI GODS NVIDIA FIX LOG >> "%LOG%"
echo   %DATE%  %TIME% >> "%LOG%"
echo   Computer: %COMPUTERNAME% >> "%LOG%"
echo ============================================================ >> "%LOG%"
echo. >> "%LOG%"

cls
echo.
echo  ============================================================
echo    OPTI GODS by leaq  --  NVIDIA Fix  [Admin OK]
echo    Log being written to your Desktop: OptiGods-Fix-Log.txt
echo  ============================================================
echo.
echo  Press any key to start...
pause >nul

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ── STEP 1: Checking if NVIDIA driver is installed at all ────
echo  ── STEP 1 ─────────────────────────────────────────── >> "%LOG%"

set "NV_FOUND=0"
sc query "NVDisplay.ContainerLocalSystem" >nul 2>&1
if %errorlevel% equ 0 set "NV_FOUND=1"

if "!NV_FOUND!"=="1" (
    echo  [OK] NVIDIA service exists on this PC.
    echo  NVIDIA service EXISTS >> "%LOG%"
) else (
    echo  [!!] NVIDIA Display Container service NOT FOUND.
    echo  [!!] This means the NVIDIA driver is not installed or is corrupt.
    echo  [!!] No bat file can fix this. You need to reinstall the driver.
    echo.
    echo  NVIDIA SERVICE NOT FOUND - DRIVER MISSING OR CORRUPT >> "%LOG%"
    echo.
    echo  ── WHAT TO DO ──────────────────────────────────────────────
    echo   1. Download DDU: https://www.wagnardsoft.com
    echo   2. Download your driver: https://www.nvidia.com/drivers
    echo   3. Boot into Safe Mode (hold Shift + Restart)
    echo   4. Run DDU, select GPU, click "Clean and restart"
    echo   5. Install the driver you downloaded
    echo  ────────────────────────────────────────────────────────────
    echo.
    echo  WHAT TO DO: DDU + clean driver install >> "%LOG%"
    echo  DDU: https://www.wagnardsoft.com >> "%LOG%"
    echo  Drivers: https://www.nvidia.com/drivers >> "%LOG%"
    goto :DONE
)

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ── STEP 2: Checking service status ──────────────────────────
echo  ── STEP 2 ─────────────────────────────────────────── >> "%LOG%"

sc query "NVDisplay.ContainerLocalSystem" >> "%LOG%" 2>&1
sc query "NVDisplay.ContainerLocalSystem"
echo.

:: ════════════════════════════════════════════════════════════════════════════
echo  ── STEP 3: Re-enabling + starting all NVIDIA services ───────
echo  ── STEP 3 ─────────────────────────────────────────── >> "%LOG%"
echo.

for %%S in (
    "NVDisplay.ContainerLocalSystem"
    "NvContainerLocalSystem"
    "NVSvc"
    "nvsvc"
    "NvTelemetryContainer"
    "NvContainerNetworkService"
    "nvagent"
    "NvModuleTracker"
) do (
    sc config %%S start= auto  >nul 2>&1
    sc start  %%S              >nul 2>&1
    sc query  %%S              >> "%LOG%" 2>&1
    sc query  %%S
    echo.
)

:: ════════════════════════════════════════════════════════════════════════════
echo  ── STEP 4: Removing policy blocks (OO ShutUp / WinUtil) ─────
echo  ── STEP 4 ─────────────────────────────────────────── >> "%LOG%"
echo.

reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v DenyDeviceIDs            /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v DenyDeviceIDsRetroactive /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v DenyDeviceClasses        /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate"              /v ExcludeWUDriversInQualityUpdate /f >nul 2>&1
echo  Device install restrictions cleared >> "%LOG%"
echo  [OK] Device install restrictions cleared.

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ── STEP 5: HAGS, TDR, FPS cap ───────────────────────────────
echo  ── STEP 5 ─────────────────────────────────────────── >> "%LOG%"
echo.

reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 2 /f
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v TdrLevel  /t REG_DWORD /d 3 /f
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v TdrDelay  /t REG_DWORD /d 8 /f
reg delete "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v DxgkrnlDriverType /f >nul 2>&1
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak" /v FrameRateLimit /f >nul 2>&1
reg delete "HKCU\SOFTWARE\NVIDIA Corporation\Global\NVTweak"                /v FrameRateLimit /f >nul 2>&1
echo  HAGS=2, TDR safe, FPS cap cleared >> "%LOG%"
echo  [OK] HAGS re-enabled, TDR reset, FPS cap cleared.

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ── STEP 6: Re-register NVIDIA Control Panel shell extension ─
echo  ── STEP 6 ─────────────────────────────────────────── >> "%LOG%"
echo.

regsvr32 /s "%SystemRoot%\System32\nvshext.dll"
if %errorlevel% equ 0 (
    echo  [OK] nvshext.dll registered - NCP will appear in right-click menu.
    echo  nvshext.dll registered OK >> "%LOG%"
) else (
    echo  [!!] nvshext.dll NOT found - driver reinstall required.
    echo  nvshext.dll NOT FOUND - driver reinstall needed >> "%LOG%"
)

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ── STEP 7: Power plan + Xbox services ───────────────────────
echo  ── STEP 7 ─────────────────────────────────────────── >> "%LOG%"
echo.

powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
powercfg /setacvalueindex 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c sub_processor PROCTHROTTLEMIN 100
powercfg /setacvalueindex 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c sub_processor PROCTHROTTLEMAX 100
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
powercfg /getactivescheme >> "%LOG%" 2>&1
echo  [OK] High Performance plan set, CPU 100%%.

sc config "XblAuthManager" start= demand >nul 2>&1
sc config "XblGameSave"    start= demand >nul 2>&1
sc config "XboxGipSvc"     start= demand >nul 2>&1
sc config "XboxNetApiSvc"  start= demand >nul 2>&1
sc config "Winmgmt"        start= auto   >nul 2>&1
sc start  "Winmgmt"                      >nul 2>&1
echo  [OK] Xbox services restored to Manual. WMI service started.
echo  Xbox + WMI services restored >> "%LOG%"

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  ── STEP 8: Final NVIDIA service restart ─────────────────────
echo  ── STEP 8 ─────────────────────────────────────────── >> "%LOG%"
echo.

sc stop  "NVDisplay.ContainerLocalSystem" >nul 2>&1
echo  Waiting 3 seconds...
timeout /t 3 /nobreak >nul
sc start "NVDisplay.ContainerLocalSystem"
timeout /t 2 /nobreak >nul
sc query "NVDisplay.ContainerLocalSystem"
sc query "NVDisplay.ContainerLocalSystem" >> "%LOG%" 2>&1

:: ════════════════════════════════════════════════════════════════════════════
:DONE
echo.
echo  ============================================================
echo   COMPLETE. Log saved to: %LOG%
echo.
echo   NEXT STEPS:
echo    1. REBOOT NOW
echo    2. After reboot: right-click desktop - NVIDIA Control Panel
echo    3. If NCP still missing: you need a clean driver reinstall
echo       - DDU: https://www.wagnardsoft.com
echo       - Driver: https://www.nvidia.com/drivers
echo    4. Send the log file on your Desktop to leaq
echo       (OptiGods-Fix-Log.txt) so he can see what happened
echo  ============================================================
echo.
echo  DONE %DATE% %TIME% >> "%LOG%"
echo.
pause
