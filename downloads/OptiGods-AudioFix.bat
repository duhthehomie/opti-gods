@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-AudioFix.ps1"

title Opti Gods by leaq  --  Audio Cutout Fix

echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  Audio Fix
echo    Kills beeps, pops, and cutouts
echo  ==========================================
echo.
echo  [1/2] Extracting audio fix script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Please re-download from the website.
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo       Click "Yes" to apply the audio fix as Administrator.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled or launch failed: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
$ErrorActionPreference = 'SilentlyContinue'

if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  !! This script must run as Administrator !!" -ForegroundColor Red
    Write-Host "  Please re-download and run the .bat file from the website." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

trap {
    Write-Host ""
    Write-Host "  [FATAL ERROR] $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "  Press Enter to close"
    break
}

Clear-Host
Write-Host "=====================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq" -ForegroundColor Red
Write-Host "  Audio Cutout / Beep / Pop Fix" -ForegroundColor White
Write-Host "  Running as: $env:USERNAME (Admin)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Red
Write-Host ""

# ── 1. MMCSS Audio task ────────────────────────────────────────────────────
Write-Host "  [1/5] Tuning MMCSS Audio scheduler task..." -ForegroundColor White
$audio = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Audio'
if (!(Test-Path $audio)) { New-Item $audio -Force | Out-Null }
Set-ItemProperty $audio 'Scheduling Category' 'Medium' -Type String -Force
Set-ItemProperty $audio 'Priority'             6        -Type DWord  -Force
Set-ItemProperty $audio 'SFIO Priority'        'High'   -Type String -Force
Set-ItemProperty $audio 'Background Only'      'False'  -Type String -Force
Set-ItemProperty $audio 'Clock Rate'           10000    -Type DWord  -Force
Set-ItemProperty $audio 'GPU Priority'         8        -Type DWord  -Force
Write-Host "        OK — Priority=6, SFIO=High, ClockRate=0.5ms" -ForegroundColor Green

# ── 2. MMCSS Pro Audio task ────────────────────────────────────────────────
Write-Host "  [2/5] Tuning MMCSS Pro Audio task (Realtek / Voicemeeter)..." -ForegroundColor White
$proAudio = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Pro Audio'
if (!(Test-Path $proAudio)) { New-Item $proAudio -Force | Out-Null }
Set-ItemProperty $proAudio 'Scheduling Category' 'High'  -Type String -Force
Set-ItemProperty $proAudio 'Priority'             6       -Type DWord  -Force
Set-ItemProperty $proAudio 'SFIO Priority'        'High'  -Type String -Force
Set-ItemProperty $proAudio 'Background Only'      'False' -Type String -Force
Set-ItemProperty $proAudio 'Clock Rate'           10000   -Type DWord  -Force
Set-ItemProperty $proAudio 'GPU Priority'         8       -Type DWord  -Force
Write-Host "        OK — High scheduling, deterministic CPU slice" -ForegroundColor Green

# ── 3. SystemResponsiveness + NetworkThrottling ────────────────────────────
Write-Host "  [3/5] Setting SystemResponsiveness + removing network throttle..." -ForegroundColor White
$sp = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
Set-ItemProperty $sp 'SystemResponsiveness'   10         -Type DWord -Force
Set-ItemProperty $sp 'NetworkThrottlingIndex' 0xFFFFFFFF -Type DWord -Force
Write-Host "        OK — 90% CPU to game/audio threads, UDP throttle removed" -ForegroundColor Green

# ── 4. Disable audio enhancements on ALL render endpoints ─────────────────
Write-Host "  [4/5] Disabling audio enhancements (APO / EQ / Windows Sonic)..." -ForegroundColor White
$renderPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'
if (Test-Path $renderPath) {
    $devCount = 0
    Get-ChildItem $renderPath | ForEach-Object {
        $propsPath = "$($_.PSPath)\Properties"
        if (Test-Path $propsPath) {
            # Disable system effects (APO chain)
            Set-ItemProperty $propsPath '{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5' 1 -Type DWord -Force -EA SilentlyContinue
            # Disable spatial audio / Windows Sonic
            Set-ItemProperty $propsPath '{62ec7b65-4a0a-4e49-8a4e-16a6e95d756e},1' 0 -Type DWord -Force -EA SilentlyContinue
            # Allow + prioritise exclusive mode
            Set-ItemProperty $propsPath '{b3f8fa53-0004-438e-9003-51a46e139bfc},3' 1 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $propsPath '{b3f8fa53-0004-438e-9003-51a46e139bfc},4' 1 -Type DWord -Force -EA SilentlyContinue
            $devCount++
        }
    }
    Write-Host "        OK — enhancements OFF on $devCount device(s), exclusive mode ON" -ForegroundColor Green
} else {
    Write-Host "        No render devices found — open Sound settings and retry" -ForegroundColor Yellow
}

# ── 5. Realtek codec power management ─────────────────────────────────────
Write-Host "  [5/5] Disabling Realtek audio codec power management..." -ForegroundColor White
$rtPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e96c-e325-11ce-bfc1-08002be10318}'
$found = $false
if (Test-Path $rtPath) {
    Get-ChildItem $rtPath -EA SilentlyContinue | ForEach-Object {
        $desc = (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc
        if ($desc -match 'Realtek|HD Audio') {
            Set-ItemProperty $_.PSPath 'ConservationIdleTime' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $_.PSPath 'PerformanceIdleTime'  0 -Type DWord -Force -EA SilentlyContinue
            Write-Host "        OK — $desc codec stays awake (no power-down mid-game)" -ForegroundColor Green
            $found = $true
        }
    }
}
if (!$found) { Write-Host "        No Realtek device found — skipped" -ForegroundColor DarkGray }

# ── Done ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  =====================================" -ForegroundColor Red
Write-Host "   DONE — Audio fix applied" -ForegroundColor White
Write-Host "   No reboot needed. Takes effect now." -ForegroundColor DarkGray
Write-Host "  =====================================" -ForegroundColor Red
Write-Host ""
Write-Host "  If using Voicemeeter, restart it now." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close"
