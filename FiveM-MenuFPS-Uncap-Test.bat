@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap - Multi Method Test
echo  by leaq
echo ============================================
echo.
echo NOTE: Run as Administrator. Reboot required
echo after bcdedit change. Test each section.
echo.

:: ─────────────────────────────────────────────
:: METHOD 1: NVIDIA OpenGL GDI (original method)
:: ─────────────────────────────────────────────
echo [1/3] NVIDIA OpenGL GDI Compatibility...
set "nv_found=0"
for /L %%i in (0,1,3) do (
    set "key=HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i"
    reg query "!key!" /v DriverDesc 2>nul | findstr /i "NVIDIA" >nul 2>&1
    if !errorlevel!==0 (
        reg add "!key!" /v OpenGLCompatibilityMode /t REG_DWORD /d 0 /f >nul 2>&1
        echo     [OK] Prefer Performance set on NVIDIA key 000%%i
        set "nv_found=1"
    )
)
if "!nv_found!"=="0" echo     [SKIP] NVIDIA key not found
echo.

:: ─────────────────────────────────────────────
:: METHOD 2: Force Fullscreen Exclusive in CitizenFX.ini
:: CEF in exclusive fullscreen bypasses DWM frame cap
:: ─────────────────────────────────────────────
echo [2/3] Forcing Fullscreen Exclusive in CitizenFX.ini...
set "ini=%LOCALAPPDATA%\FiveM\FiveM.app\CitizenFX.ini"
if exist "!ini!" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='!ini!'; $c=Get-Content $f -Raw; if($c -match 'Fullscreen=false'){$c=$c -replace 'Fullscreen=false','Fullscreen=true'; Set-Content $f $c -Encoding UTF8; Write-Host '    [OK] Changed Fullscreen=false -> Fullscreen=true'} elseif($c -notmatch 'Fullscreen=true'){Add-Content $f 'Fullscreen=true'; Write-Host '    [OK] Added Fullscreen=true'} else {Write-Host '    [OK] Already Fullscreen=true'}"
) else (
    echo     [SKIP] CitizenFX.ini not found at !ini!
    echo     Launch FiveM once first to generate it.
)
echo.

:: ─────────────────────────────────────────────
:: METHOD 3: Disable Dynamic Tick (timer resolution)
:: CEF internal frame timer depends on Windows tick
:: Requires reboot to take effect
:: ─────────────────────────────────────────────
echo [3/3] Disabling dynamic tick (improves timer resolution)...
bcdedit /set disabledynamictick yes >nul 2>&1
if !errorlevel!==0 (
    echo     [OK] disabledynamictick=yes set — REBOOT REQUIRED
) else (
    echo     [FAIL] bcdedit failed — must run as Administrator
)
echo.

echo ============================================
echo  REBOOT your PC then launch FiveM via the
echo  desktop shortcut and check menu FPS.
echo  If still capped, reply with your monitor
echo  Hz and whether you use borderless/fullscreen
echo ============================================
pause
