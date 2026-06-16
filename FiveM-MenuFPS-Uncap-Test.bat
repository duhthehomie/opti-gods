@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap - fivem.cfg fix
echo  by leaq  ^|  No reboot needed
echo ============================================
echo.

set "CFG=%APPDATA%\CitizenFX\fivem.cfg"

if not exist "%APPDATA%\CitizenFX" (
    echo [!] CitizenFX folder not found at %APPDATA%\CitizenFX
    echo     Creating...
    mkdir "%APPDATA%\CitizenFX"
)

if not exist "%CFG%" (
    echo [!] fivem.cfg not found - creating fresh one...
    type nul > "%CFG%"
)

echo Patching: %CFG%
echo.

set "TMP=%TEMP%\fivem_cfg_clean.txt"
if exist "%TMP%" del "%TMP%"

:: Copy file, skipping any existing nui_ framerate lines
for /f "usebackq tokens=* delims=" %%L in ("%CFG%") do (
    set "LINE=%%L"
    echo !LINE! | findstr /i /c:"nui_maxFramerate" /c:"nui_framerate" >nul 2>&1
    if errorlevel 1 (
        echo !LINE!>> "%TMP%"
    ) else (
        echo     [Removed old line]: !LINE!
    )
)

:: Append correct convar syntax
echo set nui_maxFramerate 9999>> "%TMP%"
echo set nui_framerate 9999>> "%TMP%"
echo set nui_useD3D11 0>> "%TMP%"

copy /y "%TMP%" "%CFG%" >nul
del "%TMP%" >nul 2>&1

echo [OK] fivem.cfg updated
echo.
echo ============================================
echo  Current fivem.cfg:
echo ============================================
type "%CFG%"
echo.
echo ============================================
echo  Launch FiveM from shortcut and check FPS.
echo  Path patched: %CFG%
echo ============================================
pause
