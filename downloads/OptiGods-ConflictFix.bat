@echo off
:: ============================================================
:: OPTI GODS by leaq  --  Stacked Optimizer Conflict Fix
:: Pure .bat — no PowerShell. Works even when PS is blocked.
:: ============================================================
setlocal EnableDelayedExpansion

:: Must run as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  !! NOT running as Administrator !!
    echo  Right-click this file and choose "Run as administrator"
    echo.
    pause
    exit /b 1
)

title Opti Gods by leaq  --  Conflict Fix [Admin]
color 4F

cls
echo.
echo  ================================================================
echo    OPTI GODS by leaq  --  Stacked Optimizer Conflict Fix
echo    Repairs damage from WinUtil / OO ShutUp / other tools
echo    Running as Administrator
echo  ================================================================
echo.
echo  This window will stay open so you can read every step.
echo.
pause

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 1] Re-enabling NVIDIA services via sc.exe...
echo  ────────────────────────────────────────────────────
echo.

sc config "NVDisplay.ContainerLocalSystem" start= auto
sc start  "NVDisplay.ContainerLocalSystem"
sc config "NvContainerLocalSystem"          start= auto
sc start  "NvContainerLocalSystem"
sc config "NVSvc"                           start= auto
sc start  "NVSvc"
sc config "nvsvc"                           start= auto
sc start  "nvsvc"
sc config "NvTelemetryContainer"            start= auto
sc start  "NvTelemetryContainer"
sc config "nvagent"                         start= demand
sc start  "nvagent"
sc config "NvModuleTracker"                 start= demand
sc start  "NvModuleTracker"
sc config "NvContainerNetworkService"       start= auto
sc start  "NvContainerNetworkService"

echo.
echo  NVIDIA services set to Automatic and started.

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 2] Re-enabling critical display + WMI services...
echo  ─────────────────────────────────────────────────────────
echo.

sc config "Winmgmt"      start= auto
sc start  "Winmgmt"
sc config "DPS"          start= auto
sc start  "DPS"
sc config "XblAuthManager" start= demand
sc config "XblGameSave"    start= demand
sc config "XboxGipSvc"     start= demand
sc config "XboxNetApiSvc"  start= demand

echo.
echo  Critical services restored.

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 3] Restoring NVIDIA registry keys via reg.exe...
echo  ─────────────────────────────────────────────────────────
echo.

:: Reset TDR to safe defaults (bad TDR = micro-stutter / "feels 30fps")
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v "TdrLevel" /t REG_DWORD /d 3 /f
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v "TdrDelay" /t REG_DWORD /d 8 /f
reg delete "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v "TdrDdiDelay" /f >nul 2>&1

:: Re-enable HAGS (always ON for NVIDIA Win11)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v "HwSchMode" /t REG_DWORD /d 2 /f

:: Remove driver-type override
reg delete "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v "DxgkrnlDriverType" /f >nul 2>&1

:: Remove NVIDIA driver-level FPS cap
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak" /v "FrameRateLimit" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\NVIDIA Corporation\Global\NVTweak" /v "FrameRateLimit" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\NVIDIA Corporation\Global\NVTweak" /v "FrameRateLimit" /f >nul 2>&1

:: Remove VSync override that makes games feel capped
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak" /v "VSyncMode" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\NVIDIA Corporation\Global\NVTweak" /v "VSyncMode" /f >nul 2>&1

echo.
echo  TDR reset, HAGS re-enabled, FPS cap + VSync override cleared.

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 4] Removing device install policy locks (OO ShutUp)...
echo  ──────────────────────────────────────────────────────────────
echo.

reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v "DenyDeviceIDs"            /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v "DenyDeviceIDsRetroactive" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v "DenyDeviceClasses"        /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Restrictions" /v "DenyRemovableDevices"     /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate"              /v "ExcludeWUDriversInQualityUpdate" /f >nul 2>&1

echo.
echo  OO ShutUp device restrictions removed.

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 5] Restoring fullscreen exclusive mode (GameConfigStore)...
echo  ──────────────────────────────────────────────────────────────────
echo.

reg add "HKCU\System\GameConfigStore" /v "GameDVR_Enabled"                        /t REG_DWORD /d 0 /f
reg add "HKCU\System\GameConfigStore" /v "GameDVR_FSEBehaviorMode"                /t REG_DWORD /d 2 /f
reg add "HKCU\System\GameConfigStore" /v "GameDVR_HonorUserFSEBehaviorMode"       /t REG_DWORD /d 1 /f
reg add "HKCU\System\GameConfigStore" /v "GameDVR_DXGIHonorFSEWindowsCompatible" /t REG_DWORD /d 1 /f
reg add "HKCU\System\GameConfigStore" /v "GameDVR_EFSEFeatureFlags"               /t REG_DWORD /d 0 /f

echo.
echo  Fullscreen exclusive mode restored.

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 6] Power plan - High Performance, CPU 100% min/max...
echo  ─────────────────────────────────────────────────────────────
echo.

powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
powercfg /setacvalueindex 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c sub_processor PROCTHROTTLEMIN 100
powercfg /setacvalueindex 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c sub_processor PROCTHROTTLEMAX 100
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
powercfg /getactivescheme

echo.
echo  High Performance plan active. CPU min/max = 100%%.

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 7] Re-registering NVIDIA Control Panel shell extension...
echo  ─────────────────────────────────────────────────────────────────
echo.

regsvr32 /s "%SystemRoot%\System32\nvshext.dll"
if %errorlevel% equ 0 (
    echo  nvshext.dll registered OK - NCP should appear in right-click menu.
) else (
    echo  nvshext.dll not found - NVIDIA driver reinstall may be needed.
)

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  [PHASE 8] Final NVIDIA service restart...
echo  ──────────────────────────────────────────
echo.

sc stop  "NVDisplay.ContainerLocalSystem" >nul 2>&1
timeout /t 3 /nobreak >nul
sc start "NVDisplay.ContainerLocalSystem"
timeout /t 2 /nobreak >nul
sc query "NVDisplay.ContainerLocalSystem"

:: ────────────────────────────────────────────────────────────────────────────
echo.
echo  ================================================================
echo    ALL PHASES COMPLETE
echo    ---
echo    REBOOT YOUR PC NOW.
echo    ---
echo    After reboot:
echo      1. Right-click desktop - NVIDIA Control Panel
echo      2. Display - Change resolution - set your Hz
echo      3. If NCP still missing - clean reinstall NVIDIA driver
echo         (DDU from wagnardsoft.com then reinstall from nvidia.com)
echo    ---
echo    If your refresh rate was stuck, that is from a different
echo    optimizer tool setting policy locks - NOT Opti Gods.
echo    Opti Gods does not touch display refresh rate or NVIDIA
echo    service startup config.
echo  ================================================================
echo.
pause
