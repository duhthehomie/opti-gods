@echo off
setlocal enabledelayedexpansion
set "OUT=%USERPROFILE%\Desktop\FiveM-Scan-Results.txt"

echo FiveM Config Scanner by leaq > "%OUT%"
echo Scanned: %DATE% %TIME% >> "%OUT%"
echo. >> "%OUT%"

:: Write the PowerShell scanner to a temp file to avoid cmd escaping issues
set "PS=%TEMP%\fivem_scan.ps1"

(
echo $out = "$env:USERPROFILE\Desktop\FiveM-Scan-Results.txt"
echo function W { param($s) Add-Content $out $s }
echo.
echo W "============================================"
echo W "FIVEM SHORTCUT ARGUMENTS"
echo W "============================================"
echo $wsh = New-Object -ComObject WScript.Shell
echo $lnks = @(
echo     "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk",
echo     "$env:PUBLIC\Desktop\FiveM.lnk",
echo     "$env:USERPROFILE\Desktop\FiveM.lnk"
echo )
echo foreach ($lnk in $lnks) {
echo     if (Test-Path $lnk) {
echo         $sc = $wsh.CreateShortcut($lnk)
echo         W ("Shortcut: " + $lnk)
echo         W ("  Target : " + $sc.TargetPath)
echo         W ("  Args   : " + $sc.Arguments)
echo         W ""
echo     }
echo }
echo.
echo W "============================================"
echo W "FIVEM APPDATA FOLDER LISTING"
echo W "============================================"
echo $dirs = @(
echo     "$env:LOCALAPPDATA\FiveM\FiveM.app",
echo     "$env:LOCALAPPDATA\FiveM",
echo     "$env:APPDATA\CitizenFX"
echo )
echo foreach ($d in $dirs) {
echo     if (Test-Path $d) {
echo         W ("--- $d ---")
echo         Get-ChildItem $d -ErrorAction SilentlyContinue ^| ForEach-Object { W ("  " + $_.Name) }
echo         W ""
echo     }
echo }
echo.
echo W "============================================"
echo W "CITIZENFX.INI CONTENTS"
echo W "============================================"
echo foreach ($d in $dirs) {
echo     $f = "$d\CitizenFX.ini"
echo     if (Test-Path $f) {
echo         W ("--- $f ---")
echo         Get-Content $f ^| ForEach-Object { W $_ }
echo         W ""
echo     }
echo }
echo.
echo W "============================================"
echo W "OTHER CONFIG FILES (user.cfg / game.cfg / settings.xml)"
echo W "============================================"
echo foreach ($d in $dirs) {
echo     foreach ($name in @("user.cfg","game.cfg","settings.xml","config.ini","client.cfg")) {
echo         $f = "$d\$name"
echo         if (Test-Path $f) {
echo             W ("--- $f ---")
echo             Get-Content $f ^| ForEach-Object { W $_ }
echo             W ""
echo         }
echo     }
echo }
echo.
echo W "============================================"
echo W "FIVEM VERSION FILES"
echo W "============================================"
echo foreach ($d in $dirs) {
echo     foreach ($name in @("app.manifest","version.txt","build.txt","citizen.manifest")) {
echo         $f = "$d\$name"
echo         if (Test-Path $f) {
echo             W ("--- $f ---")
echo             Get-Content $f -ErrorAction SilentlyContinue ^| ForEach-Object { W $_ }
echo             W ""
echo         }
echo     }
echo }
echo.
echo W "============================================"
echo W "LATEST FIVEM LOG (last 80 lines)"
echo W "============================================"
echo $logDirs = @("$env:LOCALAPPDATA\FiveM\FiveM.app\logs","$env:LOCALAPPDATA\FiveM\logs","$env:APPDATA\CitizenFX\logs")
echo foreach ($ld in $logDirs) {
echo     if (Test-Path $ld) {
echo         $latest = Get-ChildItem $ld -Filter "*.log" ^| Sort-Object LastWriteTime -Descending ^| Select-Object -First 1
echo         if ($latest) {
echo             W ("--- $($latest.FullName) ---")
echo             Get-Content $latest.FullName -Tail 80 ^| ForEach-Object { W $_ }
echo             W ""
echo             break
echo         }
echo     }
echo }
echo.
echo W "============================================"
echo W "NVIDIA DRIVER + MONITOR REFRESH RATE"
echo W "============================================"
echo Get-WmiObject Win32_VideoController ^| ForEach-Object {
echo     W ("  GPU        : " + $_.Name)
echo     W ("  Driver     : " + $_.DriverVersion)
echo     W ("  Refresh    : " + $_.CurrentRefreshRate + " Hz")
echo     W ("  MaxRefresh : " + $_.MaxRefreshRate + " Hz")
echo     W ""
echo }
echo.
echo W "============================================"
echo W "HAGS STATUS"
echo W "============================================"
echo $hags = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name HwSchMode -ErrorAction SilentlyContinue).HwSchMode
echo W ("HwSchMode = $hags  (1=Off, 2=On)")
echo W ""
echo.
echo W "============================================"
echo W "NVIDIA OPENGL REGISTRY KEYS"
echo W "============================================"
echo 0..3 ^| ForEach-Object {
echo     $k = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\{0:D4}" -f $_
echo     if (Test-Path $k) {
echo         $desc = (Get-ItemProperty $k -ErrorAction SilentlyContinue).DriverDesc
echo         if ($desc -match "NVIDIA") {
echo             W ("  Key $_ ($desc)")
echo             $ogl = (Get-ItemProperty $k -ErrorAction SilentlyContinue).OpenGLCompatibilityMode
echo             $si  = (Get-ItemProperty $k -ErrorAction SilentlyContinue).OpenGLDefaultSwapInterval
echo             W ("    OpenGLCompatibilityMode  = $ogl")
echo             W ("    OpenGLDefaultSwapInterval= $si")
echo             W ""
echo         }
echo     }
echo }
echo.
echo W "============================================"
echo W "SCAN COMPLETE"
echo W "============================================"
) > "%PS%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"
del "%PS%" >nul 2>&1

echo.
echo Scan saved to: %OUT%
echo.
echo Attach FiveM-Scan-Results.txt from your Desktop to the chat!
echo.
pause
