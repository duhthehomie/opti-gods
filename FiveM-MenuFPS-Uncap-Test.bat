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
    for /f "tokens=*" %%d in ('reg query "!key!" /v DriverDesc 2^>nul ^| findstr /i "NVIDIA"') do (
        reg add "!key!" /v OpenGLCompatibilityMode /t REG_DWORD /d 0 /f >nul 2>&1
        echo [NVIDIA] OpenGL GDI Compatibility = Prefer Performance on key 000%%i
        set "found=1"
    )
)
if "!found!"=="0" echo [SKIP] NVIDIA GPU key not found - not an NVIDIA system or key index differs

echo.

:: --- Patch FiveM shortcut with +set fps_max 0 ---
echo [2/2] Patching FiveM shortcuts...
set "patched=0"

powershell -NoProfile -Command " ^
    $wsh = New-Object -ComObject WScript.Shell; ^
    $paths = @( ^
        '$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk', ^
        '$env:PUBLIC\Desktop\FiveM.lnk', ^
        '$env:USERPROFILE\Desktop\FiveM.lnk', ^
        '$env:OneDrive\Desktop\FiveM.lnk' ^
    ); ^
    $updated = 0; ^
    foreach ($p in $paths) { ^
        if (Test-Path $p) { ^
            try { ^
                $sc = $wsh.CreateShortcut($p); ^
                if ($sc.Arguments -notmatch 'fps_max') { ^
                    $sc.Arguments = ($sc.Arguments + ' +set fps_max 0').Trim(); ^
                    $sc.Save(); ^
                    Write-Host ('[OK] Patched: ' + $p) -ForegroundColor Green ^
                } else { ^
                    Write-Host ('[OK] Already has fps_max: ' + $p) -ForegroundColor DarkGray ^
                }; ^
                $updated++ ^
            } catch { ^
                Write-Host ('[FAIL] Could not patch: ' + $p) -ForegroundColor Yellow ^
            } ^
        } ^
    }; ^
    if ($updated -eq 0) { ^
        Write-Host '[!] No FiveM shortcuts found automatically.' -ForegroundColor Yellow; ^
        Write-Host '[>] Manual fix: right-click FiveM shortcut -> Properties -> Target -> append: +set fps_max 0' -ForegroundColor Cyan ^
    } ^
"

echo.
echo ============================================
echo  Done. Close FiveM completely then relaunch
echo  via the patched shortcut to test.
echo ============================================
pause
