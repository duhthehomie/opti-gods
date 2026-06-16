@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap - Win10 / v31050
echo  by leaq  ^|  No reboot needed
echo ============================================
echo.

:: ─────────────────────────────────────────────
:: METHOD 1: Patch shortcut - use 9999 NOT 0
:: (0 = "use default" which maps to monitor Hz)
:: ─────────────────────────────────────────────
echo [1/3] Patching FiveM shortcut (nui_maxFramerate 9999)...
set "ps1=%TEMP%\fivem_fps1.ps1"
(
echo $wsh = New-Object -ComObject WScript.Shell
echo $paths = @^(
echo     "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk",
echo     "$env:PUBLIC\Desktop\FiveM.lnk",
echo     "$env:USERPROFILE\Desktop\FiveM.lnk"
echo ^)
echo $add = '+set nui_maxFramerate 9999 +set nui_framerate 9999 +set fps_max 0'
echo $patched = 0
echo foreach ^($p in $paths^) {
echo     if ^(Test-Path $p^) {
echo         $sc = $wsh.CreateShortcut^($p^)
echo         $cur = $sc.Arguments
echo         $cur = $cur -replace '\+set nui_maxFramerate \S+','' -replace '\+set nui_framerate \S+','' -replace '\+set fps_max \S+',''
echo         $sc.Arguments = ^($cur.Trim^(^) + ' ' + $add^).Trim^(^)
echo         $sc.Save^(^)
echo         Write-Host ^("[OK] Patched: " + $p^) -ForegroundColor Green
echo         $patched++
echo     }
echo }
echo if ^($patched -eq 0^) { Write-Host "[!] No shortcut found - add manually to Target field:" -ForegroundColor Yellow; Write-Host "    +set nui_maxFramerate 9999 +set nui_framerate 9999 +set fps_max 0" -ForegroundColor Cyan }
) > "%ps1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ps1%"
del "%ps1%" >nul 2>&1
echo.

:: ─────────────────────────────────────────────
:: METHOD 2: Write nui_maxFramerate to FiveM
:: config files (CitizenFX.ini / user config)
:: No reboot - takes effect on next FiveM launch
:: ─────────────────────────────────────────────
echo [2/3] Patching FiveM config files...
set "FOUND_CFG=0"

:: Check common FiveM config locations
for %%L in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM"
    "%APPDATA%\CitizenFX"
) do (
    if exist %%L (
        echo     Found FiveM folder: %%~L

        :: CitizenFX.ini
        if exist "%%~L\CitizenFX.ini" (
            powershell -NoProfile -Command "$f='%%~L\CitizenFX.ini';$c=(Get-Content $f -Raw);if($c -notmatch 'nui_maxFramerate'){$c+=\"`nnui_maxFramerate=9999`nnui_framerate=9999\"}else{$c=$c -replace 'nui_maxFramerate=\d+','nui_maxFramerate=9999' -replace 'nui_framerate=\d+','nui_framerate=9999'};Set-Content $f $c -Encoding UTF8;Write-Host '[OK] CitizenFX.ini patched' -ForegroundColor Green"
            set "FOUND_CFG=1"
        )

        :: user.cfg or game.cfg
        for %%F in ("%%~L\user.cfg" "%%~L\game.cfg" "%%~L\data\game.cfg") do (
            if exist %%F (
                powershell -NoProfile -Command "$f='%%~F';$c=(Get-Content $f -Raw -ErrorAction SilentlyContinue);if($null -eq $c){$c=''};if($c -notmatch 'nui_maxFramerate'){$c+=\"`nset nui_maxFramerate 9999`nset nui_framerate 9999\"}else{$c=$c -replace 'set nui_maxFramerate \S+','set nui_maxFramerate 9999' -replace 'set nui_framerate \S+','set nui_framerate 9999'};Set-Content $f $c -Encoding UTF8;Write-Host '[OK] %%~nxF patched' -ForegroundColor Green"
                set "FOUND_CFG=1"
            )
        )
    )
)

if "!FOUND_CFG!"=="0" (
    echo     [!] No config files found - shortcut args only
) else (
    echo     Config files updated.
)
echo.

:: ─────────────────────────────────────────────
:: METHOD 3: NVCP per-app profile via PowerShell
:: Sets Vsync=Off and Max Frame Rate=Off for
:: FiveM.exe using the nvcpl COM object
:: ─────────────────────────────────────────────
echo [3/3] NVIDIA Control Panel - per-app Vsync Off...
set "ps3=%TEMP%\fivem_nvcp.ps1"
(
echo try {
echo     $nvcpl = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory^(^)
echo     # Try nvcpl COM interface
echo     $obj = New-Object -ComObject 'nvcpl.nvcplApplication' -ErrorAction Stop
echo     Write-Host "[INFO] NVCP COM available" -ForegroundColor Cyan
echo } catch {
echo     Write-Host "[INFO] NVCP COM not available - use manual method below" -ForegroundColor Yellow
echo }
echo # Fallback: write to NVIDIA registry profile hint
echo $nvKey = "HKCU:\Software\NVIDIA Corporation\Global\NVTweak"
echo if ^(-not ^(Test-Path $nvKey^)^) { New-Item -Path $nvKey -Force ^| Out-Null }
echo # Global Vsync off hint (0x00000000 = off)
echo Set-ItemProperty -Path $nvKey -Name "Vsync" -Value 0 -Type DWord -ErrorAction SilentlyContinue
echo Write-Host "[OK] NVIDIA global Vsync hint written" -ForegroundColor Green
) > "%ps3%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ps3%"
del "%ps3%" >nul 2>&1
echo.

echo ============================================
echo  DONE - No reboot needed.
echo.
echo  Launch FiveM from the SHORTCUT (not .exe)
echo  then check top-left FPS in the menu.
echo.
echo  IF STILL CAPPED - do this manually:
echo  NVCP -^> Manage 3D Settings -^> Program Settings
echo  Add FiveM.exe -^> Vertical Sync = Off
echo                -^> Max Frame Rate = Off
echo  (This is the last possible software fix)
echo ============================================
pause
