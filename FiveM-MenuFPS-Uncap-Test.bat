@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap Test - by leaq
echo ============================================
echo.

:: --- NVIDIA OpenGL GDI Compatibility = Prefer Performance ---
echo [1/2] Setting NVIDIA OpenGL GDI Compatibility...
set "found=0"
for /L %%i in (0,1,3) do (
    set "key=HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i"
    reg query "!key!" /v DriverDesc 2>nul | findstr /i "NVIDIA" >nul 2>&1
    if !errorlevel!==0 (
        reg add "!key!" /v OpenGLCompatibilityMode /t REG_DWORD /d 0 /f >nul 2>&1
        echo [NVIDIA] OpenGL GDI Compatibility = Prefer Performance on key 000%%i
        set "found=1"
    )
)
if "!found!"=="0" echo [SKIP] No NVIDIA GPU class key found

echo.
echo [2/2] Patching FiveM shortcuts...

:: Write temp PowerShell script to TEMP folder
set "ps1=%TEMP%\fivem_fps_patch.ps1"
(
echo $wsh = New-Object -ComObject WScript.Shell
echo $paths = @(
echo     "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk",
echo     "$env:PUBLIC\Desktop\FiveM.lnk",
echo     "$env:USERPROFILE\Desktop\FiveM.lnk",
echo     "$env:OneDrive\Desktop\FiveM.lnk"
echo ^)
echo $updated = 0
echo foreach ^($p in $paths^) {
echo     if ^(Test-Path $p^) {
echo         try {
echo             $sc = $wsh.CreateShortcut^($p^)
echo             if ^($sc.Arguments -notmatch 'fps_max'^) {
echo                 $sc.Arguments = ^($sc.Arguments + ' +set fps_max 0'^).Trim^(^)
echo                 $sc.Save^(^)
echo                 Write-Host ^("[OK] Patched: " + $p^) -ForegroundColor Green
echo             } else {
echo                 Write-Host ^("[OK] Already patched: " + $p^) -ForegroundColor DarkGray
echo             }
echo             $updated++
echo         } catch {
echo             Write-Host ^("[FAIL] Could not patch: " + $p^) -ForegroundColor Yellow
echo         }
echo     }
echo }
echo if ^($updated -eq 0^) {
echo     Write-Host "[!] No FiveM shortcuts found automatically." -ForegroundColor Yellow
echo     Write-Host "[>] Manual fix: right-click FiveM shortcut -> Properties -> Target -> append:  +set fps_max 0" -ForegroundColor Cyan
echo }
) > "%ps1%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ps1%"
del "%ps1%" >nul 2>&1

echo.
echo ============================================
echo  Done. Close FiveM fully then relaunch via
echo  the patched shortcut to test menu FPS.
echo ============================================
pause
