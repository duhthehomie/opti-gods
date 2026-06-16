@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap - fivem.cfg fix
echo  by leaq  ^|  No reboot needed
echo ============================================
echo.

set "CFG=%APPDATA%\CitizenFX\fivem.cfg"

if not exist "%CFG%" (
    echo [!] fivem.cfg not found at:
    echo     %CFG%
    echo     Creating it fresh...
    echo. > "%CFG%"
)

echo [1/2] Patching fivem.cfg...

:: Read file, strip old nui lines, write back clean
set "TMP=%TEMP%\fivem_cfg_tmp.txt"
if exist "%TMP%" del "%TMP%"

for /f "usebackq delims=" %%L in ("%CFG%") do (
    set "LINE=%%L"
    echo !LINE! | findstr /i "nui_maxFramerate nui_framerate" >nul 2>&1
    if errorlevel 1 (
        echo !LINE!>> "%TMP%"
    )
)

:: Append the correct convar syntax
echo set nui_maxFramerate 9999>> "%TMP%"
echo set nui_framerate 9999>> "%TMP%"

copy /y "%TMP%" "%CFG%" >nul
del "%TMP%" >nul 2>&1
echo     [OK] fivem.cfg patched
echo.

:: Show the result
echo Current fivem.cfg contents:
echo ----------------------------------------
type "%CFG%"
echo ----------------------------------------
echo.

echo [2/2] Patching FiveM shortcut args...
set "PATCHED=0"
for %%P in (
    "%APPDATA%\Microsoft\Windows\Start Menu\Programs\FiveM.lnk"
    "%USERPROFILE%\Desktop\FiveM.lnk"
    "%PUBLIC%\Desktop\FiveM.lnk"
) do (
    if exist %%P (
        echo     Found: %%~P
        set "PATCHED=1"
    )
)
if "!PATCHED!"=="0" echo     [!] No shortcuts found

echo.
echo ============================================
echo  DONE. Launch FiveM from the SHORTCUT.
echo  Check top-left FPS in the main menu.
echo ============================================
pause
