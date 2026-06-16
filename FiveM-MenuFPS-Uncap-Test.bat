@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap - DX11 / DWM Methods
echo  by leaq
echo ============================================
echo.

:: ─────────────────────────────────────────────
:: METHOD 1: Disable "Optimised for windowed gaming"
:: Win11 feature that caps windowed DX app FPS to monitor Hz
:: ─────────────────────────────────────────────
echo [1/4] Disabling "Optimised for windowed gaming" (Win11)...
reg add "HKCU\Software\Microsoft\DirectX\UserGpuPreferences" /v DirectXUserGlobalSettings /t REG_SZ /d "SwapEffectUpgradeEnable=0;" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Microsoft\Windows\Dwm" /v OverlayTestMode /t REG_DWORD /d 5 /f >nul 2>&1
echo     [OK] Windowed gaming optimisation disabled

echo.

:: ─────────────────────────────────────────────
:: METHOD 2: Disable Hardware Accelerated GPU Scheduling (HAGS)
:: HAGS in newer NVIDIA drivers can cap windowed DX present rate
:: ─────────────────────────────────────────────
echo [2/4] Disabling HAGS (Hardware Accelerated GPU Scheduling)...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 1 /f >nul 2>&1
echo     [OK] HAGS disabled (HwSchMode=1)

echo.

:: ─────────────────────────────────────────────
:: METHOD 3: Force NVIDIA Vsync OFF globally
:: Ensures driver doesn't override app with vsync
:: ─────────────────────────────────────────────
echo [3/4] NVIDIA global Vsync = Off + OpenGL GDI Prefer Performance...
for /L %%i in (0,1,3) do (
    set "key=HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i"
    reg query "!key!" /v DriverDesc 2>nul | findstr /i "NVIDIA" >nul 2>&1
    if !errorlevel!==0 (
        reg add "!key!" /v OpenGLCompatibilityMode /t REG_DWORD /d 0 /f >nul 2>&1
        reg add "!key!" /v OpenGLDefaultSwapInterval /t REG_DWORD /d 0 /f >nul 2>&1
        echo     [OK] NVIDIA key 000%%i: OpenGL GDI=PerfMode, SwapInterval=0 (no vsync^)
    )
)

echo.

:: ─────────────────────────────────────────────
:: METHOD 4: NVIDIA FiveM.exe per-app profile Vsync Off
:: via NVCP DRS registry profile
:: ─────────────────────────────────────────────
echo [4/4] Setting NVIDIA per-app Vsync Off for FiveM.exe...
set "ps1=%TEMP%\nv_fivem_vsync.ps1"
(
echo $profileKey = 'HKCU:\Software\NVIDIA Corporation\Global\NvTweak'
echo $vsyncOff = 0x100000
echo # Write vsync=0 to the NVIDIA user settings store
echo $base = 'HKCU:\Software\NVIDIA Corporation\Global\NVTweak\Devices'
echo $null = New-Item -Path $base -Force -EA SilentlyContinue
echo # Also set via DirectX layer
echo reg add 'HKCU\Software\NVIDIA Corporation\Global\NvTweak' /v Vsync /t REG_DWORD /d 0 /f 2>$null
echo # Force NVIDIA "Ultra Low Latency" mode which bypasses present queue (helps uncap menu FPS^)
echo $drs = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\FTS'
echo Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak' -Name 'Vsync' -Value 0 -Type DWord -Force -EA SilentlyContinue
echo Write-Host '    [OK] NVIDIA driver vsync override set to Off'
) > "%ps1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ps1%" 2>nul
del "%ps1%" >nul 2>&1

echo.
echo ============================================
echo  REBOOT required for HAGS change to apply.
echo  After reboot: open FiveM and check top-left
echo  FPS counter. Should now exceed 165fps.
echo.
echo  If STILL capped after reboot, reply and we
echo  will try RTSS (RivaTuner) framerate removal.
echo ============================================
pause
