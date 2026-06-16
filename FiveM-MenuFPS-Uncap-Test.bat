@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap  by leaq
echo ============================================
echo.

:: ── FILE 1: fivem.cfg (Roaming - convar exec) ──
set "CFG1=%APPDATA%\CitizenFX\fivem.cfg"
echo Patching: %CFG1%

if not exist "%APPDATA%\CitizenFX" mkdir "%APPDATA%\CitizenFX"
if not exist "%CFG1%" type nul > "%CFG1%"

set "TMP=%TEMP%\_fmcfg.txt"
if exist "%TMP%" del "%TMP%"
for /f "usebackq tokens=* delims=" %%L in ("%CFG1%") do (
    set "L=%%L"
    echo !L! | findstr /i /c:"nui_maxFramerate" /c:"nui_framerate" /c:"nui_useD3D11" >nul 2>&1
    if errorlevel 1 echo !L!>> "%TMP%"
)
echo set nui_maxFramerate 9999>> "%TMP%"
echo set nui_framerate 9999>> "%TMP%"
copy /y "%TMP%" "%CFG1%" >nul 2>&1
del "%TMP%" >nul 2>&1
echo [OK] Done
echo.

:: ── FILE 2: CitizenFX.ini (Local FiveM.app) ──
set "CFG2=%LOCALAPPDATA%\FiveM\FiveM.app\CitizenFX.ini"
echo Patching: %CFG2%

if exist "%CFG2%" (
    set "TMP2=%TEMP%\_fmini.txt"
    if exist "%TMP2%" del "%TMP2%"
    for /f "usebackq tokens=* delims=" %%L in ("%CFG2%") do (
        set "L=%%L"
        echo !L! | findstr /i /c:"nui_maxFramerate" /c:"nui_framerate" /c:"FrameLimit" /c:"DisableVSync" /c:"PreferredRefreshRate" >nul 2>&1
        if errorlevel 1 echo !L!>> "%TMP2%"
    )
    echo DisableVSync=1>> "%TMP2%"
    echo PreferredRefreshRate=0>> "%TMP2%"
    echo FrameLimit=0>> "%TMP2%"
    echo nui_maxFramerate=9999>> "%TMP2%"
    echo nui_framerate=9999>> "%TMP2%"
    copy /y "%TMP2%" "%CFG2%" >nul 2>&1
    del "%TMP2%" >nul 2>&1
    echo [OK] Done
) else (
    echo [!] Not found - skipping
)
echo.

echo ============================================
echo  FINAL CONTENTS:
echo ============================================
echo.
echo -- %CFG1% --
type "%CFG1%"
echo.
echo -- %CFG2% (last 10 lines) --
more +100 "%CFG2%" 2>nul
echo.
echo ============================================
echo  Close FiveM fully, launch from shortcut.
echo  Check top-left FPS in the menu.
echo ============================================
pause
