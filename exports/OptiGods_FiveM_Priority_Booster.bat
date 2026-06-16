@echo off
title Opti Gods - FiveM Priority Booster

:: ── Self-elevate to Administrator if not already ──────────────────
net session >nul 2>&1
if %errorLevel% == 0 goto :ISADMIN
echo  Requesting Administrator privileges...
powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b 0

:ISADMIN
cd /d "%~dp0"
set "TMPPS=%TEMP%\optigods_fivem_%RANDOM%.ps1"

:: Extract embedded PS1 block and run it
powershell -Command "$c=[System.IO.File]::ReadAllText('%~f0'); $s=$c.IndexOf('#PS1START')+9; $e=$c.IndexOf('#PS1END'); [System.IO.File]::WriteAllText('%TMPPS%', $c.Substring($s,$e-$s).Trim())" 2>nul
if exist "%TMPPS%" (
  powershell -ExecutionPolicy Bypass -NoProfile -File "%TMPPS%"
  del "%TMPPS%" 2>nul
  exit /b 0
)

:: Fallback: inline execution if extraction failed
powershell -ExecutionPolicy Bypass -NoProfile -Command "& {
$ErrorActionPreference = 'SilentlyContinue'
$targets = @('FiveM_b3323_GTAProcess','FiveM_GTAProcess','GTA5','FiveM','FiveMApp','FXServer')
foreach($p in $targets){$x=Get-Process $p -EA SilentlyContinue;if($x){try{$x.PriorityClass='High'}catch{}}}
$k='HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games'
if(!(Test-Path $k)){New-Item $k -Force|Out-Null}
Set-ItemProperty $k 'GPU Priority' 8 -Type DWord -Force
Set-ItemProperty $k 'Priority' 6 -Type DWord -Force
Set-ItemProperty $k 'Scheduling Category' 'High' -Type String -Force
Set-ItemProperty $k 'SFIO Priority' 'High' -Type String -Force
Set-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' Win32PrioritySeparation 26 -Type DWord -Force
Write-Host '' ; Write-Host ' Done! FiveM priority set to maximum.' -ForegroundColor Red ; Write-Host ''
Read-Host 'Press Enter to exit'
}"
exit /b 0

REM #PS1START
# Opti Gods — FiveM Process Priority Booster
# Sets CPU High, GPU Priority 8, IO High for all FiveM/GTA processes
# Run as Administrator before launching FiveM

$ErrorActionPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Opti Gods - FiveM Priority Booster"

Write-Host ""
Write-Host " OPTI GODS - FiveM Priority Booster" -ForegroundColor Red
Write-Host " =====================================" -ForegroundColor DarkRed
Write-Host ""

$targets = @("FiveM_b3323_GTAProcess","FiveM_GTAProcess","GTA5","FiveM","FiveMApp","FXServer","ROSLauncher")

Write-Host " [1/3] Setting CPU Priority to HIGH..." -ForegroundColor Cyan
foreach ($proc in $targets) {
    $ps = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($ps) {
        try {
            $ps.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High
            Write-Host "   [OK] $proc -> HIGH CPU priority" -ForegroundColor Green
        } catch {
            Write-Host "   [SKIP] $proc - access denied or not running" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host " [2/3] Setting GPU Priority to 8 (max)..." -ForegroundColor Cyan
$gamesKey = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games"
if (-not (Test-Path $gamesKey)) { New-Item -Path $gamesKey -Force | Out-Null }
Set-ItemProperty -Path $gamesKey -Name "GPU Priority"        -Value 8      -Type DWord  -Force
Set-ItemProperty -Path $gamesKey -Name "Priority"            -Value 6      -Type DWord  -Force
Set-ItemProperty -Path $gamesKey -Name "Scheduling Category" -Value "High" -Type String -Force
Set-ItemProperty -Path $gamesKey -Name "SFIO Priority"       -Value "High" -Type String -Force
Write-Host "   [OK] MMCSS Games -> GPU=8, CPU=6, IO=High, Scheduling=High" -ForegroundColor Green

Write-Host ""
Write-Host " [3/3] Throttling background processes..." -ForegroundColor Cyan
$bg = @("Discord","chrome","SearchIndexer","SysMain","OneDrive","WmiPrvSE","MsMpEng")
foreach ($proc in $bg) {
    $ps = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($ps) {
        try { $ps.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal; Write-Host "   [OK] $proc -> BelowNormal" -ForegroundColor DarkGreen } catch {}
    }
}

Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl" -Name "Win32PrioritySeparation" -Value 26 -Type DWord -Force
Write-Host "   [OK] Win32PrioritySeparation = 26 (gaming optimal)" -ForegroundColor Green

Write-Host ""
Write-Host " Done! Re-run this script each time you launch FiveM." -ForegroundColor Red
Write-Host ""
Read-Host "Press Enter to exit"
REM #PS1END
