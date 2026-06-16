@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  FiveM Menu FPS Uncap - Win10 / v31050 Fix
echo  by leaq
echo ============================================
echo.

:: ─────────────────────────────────────────────
:: METHOD 1: Patch FiveM shortcut with NUI framerate convars
:: nui_maxFramerate and nui_framerate are FiveM-internal
:: controls for the CEF/NUI renderer frame rate
:: ─────────────────────────────────────────────
echo [1/3] Patching FiveM shortcut with NUI framerate args...
set "ps1=%TEMP%\fivem_nui_patch.ps1"
(
echo $wsh = New-Object -ComObject WScript.Shell
echo $paths = @(
echo     "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk",
echo     "$env:PUBLIC\Desktop\FiveM.lnk",
echo     "$env:USERPROFILE\Desktop\FiveM.lnk"
echo ^)
echo $args_to_add = '+set nui_maxFramerate 0 +set nui_framerate 0 +set fps_max 0'
echo $updated = 0
echo foreach ^($p in $paths^) {
echo     if ^(Test-Path $p^) {
echo         try {
echo             $sc = $wsh.CreateShortcut^($p^)
echo             $current = $sc.Arguments
echo             # Strip old fps_max / nui args first to avoid duplicates
echo             $current = $current -replace '\+set nui_maxFramerate \S+',''-replace '\+set nui_framerate \S+',''-replace '\+set fps_max \S+',''
echo             $sc.Arguments = ^($current.Trim^(^) + ' ' + $args_to_add^).Trim^(^)
echo             $sc.Save^(^)
echo             Write-Host ^("[OK] Patched: " + $p^) -ForegroundColor Green
echo             $updated++
echo         } catch {
echo             Write-Host ^("[FAIL] " + $p^) -ForegroundColor Yellow
echo         }
echo     }
echo }
echo if ^($updated -eq 0^) {
echo     Write-Host "[!] No shortcuts found. Add manually to Target:" -ForegroundColor Yellow
echo     Write-Host "    +set nui_maxFramerate 0 +set nui_framerate 0 +set fps_max 0" -ForegroundColor Cyan
echo }
) > "%ps1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ps1%"
del "%ps1%" >nul 2>&1
echo.

:: ─────────────────────────────────────────────
:: METHOD 2: NVIDIA OpenGL GDI + SwapInterval=0
:: ─────────────────────────────────────────────
echo [2/3] NVIDIA OpenGL GDI Prefer Performance + SwapInterval=0...
for /L %%i in (0,1,3) do (
    set "key=HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i"
    reg query "!key!" /v DriverDesc 2>nul | findstr /i "NVIDIA" >nul 2>&1
    if !errorlevel!==0 (
        reg add "!key!" /v OpenGLCompatibilityMode /t REG_DWORD /d 0 /f >nul 2>&1
        reg add "!key!" /v OpenGLDefaultSwapInterval /t REG_DWORD /d 0 /f >nul 2>&1
        echo     [OK] NVIDIA key 000%%i patched
    )
)
echo.

:: ─────────────────────────────────────────────
:: METHOD 3: Disable HAGS (Win10 2004+ has this)
:: Newer NVIDIA drivers + HAGS can cap present rate
:: ─────────────────────────────────────────────
echo [3/3] Disabling Hardware Accelerated GPU Scheduling (HAGS)...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v HwSchMode /t REG_DWORD /d 1 /f >nul 2>&1
echo     [OK] HAGS disabled - REBOOT REQUIRED
echo.

echo ============================================
echo  REBOOT then launch FiveM from the shortcut.
echo.
echo  Check top-left FPS in the menu.
echo  Tell leaq the result — if still 165fps we
echo  go the NVCP Manual route (3D Settings).
echo ============================================
pause
