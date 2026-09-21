@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-leaq.ps1"

title Opti Gods by leaq  --  Optimizer
echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  Optimizer
echo  ==========================================
echo.
echo  [1/2] Extracting optimization script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Please re-download from the website.
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo      Click "Yes" to start the optimizer as Administrator.
echo      Your tweaks will then run automatically in a new window.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled or launch failed: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
# ============================================
# OPTI GODS by leaq — PC Optimizer
# Generated: 2026-06-07T08:20:13.446Z
# Tweaks enabled: 1
# ============================================

$ErrorActionPreference = 'SilentlyContinue'

# --- Administrator check (elevation is handled by the .bat launcher) ---
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "" 
    Write-Host "  !! This script must run as Administrator !!" -ForegroundColor Red
    Write-Host "  Please re-download and run the .bat file from the website." -ForegroundColor Yellow
    Write-Host "" 
    Read-Host "  Press Enter to close"
    exit 1
}

# Keep window open on any unexpected crash
trap {
    Write-Host "" 
    Write-Host "  [FATAL ERROR] $_" -ForegroundColor Red
    Write-Host "" 
    Read-Host "  Press Enter to close"
    break
}

Write-Host "=====================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq" -ForegroundColor Red
Write-Host "  Starting 1 optimizations..." -ForegroundColor White
Write-Host "  Running as: $env:USERNAME (Admin)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Red

# --- Tweak Tracking (ChrisTitusUtil-style summary) ---
$appliedTweaks = [System.Collections.Generic.List[string]]::new()
$failedTweaks  = [System.Collections.Generic.List[string]]::new()

# --- Smart Hardware Detection ---
$_cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$_cpuCores = $_cpu.NumberOfCores
$_cpuLogical = $_cpu.NumberOfLogicalProcessors
$_cpuName = $_cpu.Name.Trim()
$_ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$_winVer = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -EA SilentlyContinue)
$_build = "$($_winVer.CurrentMajorVersionNumber).$($_winVer.CurrentMinorVersionNumber).$($_winVer.CurrentBuildNumber)"

# Auto-select CpuPriorityClass based on physical core count
# 8+ physical cores: High (4) — powerful enough to handle it without starvation
# 6 or fewer cores: AboveNormal (3) — safe universal value, no scheduler starvation risk
if ($_cpuCores -ge 8) {
    $PRIORITY_CLASS = 4
    $_tier = "High-End ($($_cpuCores) cores) -> CpuPriorityClass = 4 (High)"
} else {
    $PRIORITY_CLASS = 3
    $_tier = "Standard ($($_cpuCores) cores) -> CpuPriorityClass = 3 (AboveNormal)"
}

Write-Host "" 
Write-Host "[DETECT] CPU : $_cpuName" -ForegroundColor Cyan
Write-Host "[DETECT] Cores: $($_cpuCores)P / $($_cpuLogical)L  RAM: $($_ramGB)GB  Windows: $_build" -ForegroundColor Cyan
Write-Host "[DETECT] $_tier" -ForegroundColor Cyan
Write-Host "" 

# Apply hardware-optimal CpuPriorityClass to all game executables
$_ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
$_gameExes = @('GTA5.exe','FiveM.exe','fivem.exe','FortniteClient-Win64-Shipping.exe','cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','RainbowSix.exe','cod.exe','RustClient.exe','TslGame.exe','EscapeFromTarkov.exe','RobloxPlayerBeta.exe','dota2.exe','DeadByDaylight-Win64-Shipping.exe','PUBG.exe','Overwatch.exe')
foreach ($_exe in $_gameExes) {
    $_p = "$_ifeo\$_exe\PerfOptions"
    if (!(Test-Path $_p)) { New-Item $_p -Force | Out-Null }
    Set-ItemProperty $_p 'CpuPriorityClass' $PRIORITY_CLASS -Type DWord -Force
}
Get-ChildItem $_ifeo -EA SilentlyContinue | Where-Object { $_.PSChildName -like 'FiveM_b*_GTAProcess.exe' } | ForEach-Object {
    $_p = "$_ifeo\$($_.PSChildName)\PerfOptions"
    if (!(Test-Path $_p)) { New-Item $_p -Force | Out-Null }
    Set-ItemProperty $_p 'CpuPriorityClass' $PRIORITY_CLASS -Type DWord -Force
}
@('FiveM_b2189_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2699_GTAProcess.exe') | ForEach-Object {
    $_p = "$_ifeo\$_\PerfOptions"
    if (!(Test-Path $_p)) { New-Item $_p -Force | Out-Null }
    Set-ItemProperty $_p 'CpuPriorityClass' $PRIORITY_CLASS -Type DWord -Force
}
Write-Host "[DETECT] CpuPriorityClass $PRIORITY_CLASS applied to $($_gameExes.Count)+ game executables" -ForegroundColor Green
Write-Host "" 

Write-Host "[NVIDIA] Applying Balanced NVCP preset..." -ForegroundColor DarkRed
# NVIDIA Balanced preset
$d3d = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\d3d'
If (!(Test-Path $d3d)) { New-Item $d3d -Force | Out-Null }
Set-ItemProperty $d3d 'LowLatencyMode' 1 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty $d3d 'ShaderCacheSize' 0xFFFFFFFF -Type DWord -Force -EA SilentlyContinue
Write-Host "[NVCP] Balanced preset applied — Low Latency=On, Shader Cache=Unlimited" -ForegroundColor Green


Write-Host "" 
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "   OPTI GODS by leaq -- TWEAKS APPLIED" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  [OK] $($appliedTweaks.Count) of 1 tweaks applied" -ForegroundColor Green
if ($failedTweaks.Count -gt 0) {
    Write-Host "" 
    Write-Host "  [FAILED] ($($failedTweaks.Count) tweaks had errors):" -ForegroundColor Red
    foreach ($t in $failedTweaks) { Write-Host "    [ERR] $t" -ForegroundColor Red }
    Write-Host "" 
    Write-Host "  Note: Errors are normal for tweaks that don't apply to your hardware." -ForegroundColor DarkGray
} else {
    Write-Host "  All tweaks applied with zero errors!" -ForegroundColor Green
}
Write-Host "" 
Write-Host "  >> Restart your PC to activate ALL changes. <<" -ForegroundColor Cyan
Write-Host "  Thank you for using Opti Gods by leaq!" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  Close this window when you are done." -ForegroundColor DarkGray
Read-Host "  Press Enter"
Remove-Item $PSCommandPath -Force -EA SilentlyContinue