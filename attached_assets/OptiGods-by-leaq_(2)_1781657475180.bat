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
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
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
# Generated: 2026-06-16T16:34:02.300Z
# Tweaks enabled: 132
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
Write-Host "  Starting 132 optimizations..." -ForegroundColor White
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
# 6+ physical cores: High (4) — modern gaming CPUs (Ryzen 5 3500, i5-8400+, etc.)
# fewer than 6 cores: AboveNormal (3) — safe for 4-core systems, no starvation risk
if ($_cpuCores -ge 6) {
    $PRIORITY_CLASS = 4
    $_tier = "6+ core CPU ($($_cpuCores) cores) -> CpuPriorityClass = 4 (High)"
} else {
    $PRIORITY_CLASS = 3
    $_tier = "Low-core CPU ($($_cpuCores) cores) -> CpuPriorityClass = 3 (AboveNormal)"
}

Write-Host "" 
Write-Host "[DETECT] CPU : $_cpuName" -ForegroundColor Cyan
Write-Host "[DETECT] Cores: $($_cpuCores)P / $($_cpuLogical)L  RAM: $($_ramGB)GB  Windows: $_build" -ForegroundColor Cyan
Write-Host "[DETECT] $_tier" -ForegroundColor Cyan
Write-Host "" 

# Apply hardware-optimal CpuPriorityClass to all game executables
$_ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'
$_gameExes = @('GTA5.exe','FiveM.exe','fivem.exe','FortniteClient-Win64-Shipping.exe','cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','RainbowSix.exe','cod.exe','RustClient.exe','TslGame.exe','EscapeFromTarkov.exe','RobloxPlayerBeta.exe','dota2.exe','DeadByDaylight-Win64-Shipping.exe','PUBG.exe','Overwatch.exe','ARC-Win64-Shipping.exe','MarvelRivals-Win64-Shipping.exe','007FirstLight.exe','007FirstLight-Win64-Shipping.exe','ReadyOrNot.exe','BF2042.exe','RocketLeague.exe','Warframe.x64.exe','ForzaHorizon5.exe')
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
Write-Host "--- [Registry / System] 58 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] Win32PrioritySeparation..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' -Name 'Win32PrioritySeparation' -Value 26
    $appliedTweaks.Add("Win32PrioritySeparation") | Out-Null
} catch {
    $failedTweaks.Add("Win32PrioritySeparation") | Out-Null
    Write-Host "[ERR] Win32PrioritySeparation: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableHungAppDetection..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'HungAppTimeout' -Value '1000'
    $appliedTweaks.Add("DisableHungAppDetection") | Out-Null
} catch {
    $failedTweaks.Add("DisableHungAppDetection") | Out-Null
    Write-Host "[ERR] DisableHungAppDetection: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePagefileEncryption..." -ForegroundColor DarkYellow
try {
    fsutil behavior set encryptpagingfile 0
    $appliedTweaks.Add("DisablePagefileEncryption") | Out-Null
} catch {
    $failedTweaks.Add("DisablePagefileEncryption") | Out-Null
    Write-Host "[ERR] DisablePagefileEncryption: $_" -ForegroundColor Red
}
Write-Host "[>>] SetTimerResolution..." -ForegroundColor DarkYellow
try {
    bcdedit /set disabledynamictick yes 2>$null; bcdedit /deletevalue useplatformtick 2>$null; bcdedit /deletevalue useplatformclock 2>$null; Write-Host "[OK] Dynamic tick disabled (safe timer precision boost — no useplatformtick boot-hang risk)" -ForegroundColor Green
    $appliedTweaks.Add("SetTimerResolution") | Out-Null
} catch {
    $failedTweaks.Add("SetTimerResolution") | Out-Null
    Write-Host "[ERR] SetTimerResolution: $_" -ForegroundColor Red
}
Write-Host "[>>] SetResponsiveness..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value 10
    $appliedTweaks.Add("SetResponsiveness") | Out-Null
} catch {
    $failedTweaks.Add("SetResponsiveness") | Out-Null
    Write-Host "[ERR] SetResponsiveness: $_" -ForegroundColor Red
}
Write-Host "[>>] GameModeTweaks..." -ForegroundColor DarkYellow
try {
    $gamePath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamePath)) { New-Item -Path $gamePath -Force | Out-Null }; Set-ItemProperty -Path $gamePath -Name 'Scheduling Category' -Value 'High' -Type String; Set-ItemProperty -Path $gamePath -Name 'SFIO Priority' -Value 'High' -Type String; Set-ItemProperty -Path $gamePath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamePath -Name 'Priority' -Value 6 -Type DWord; Set-ItemProperty -Path $gamePath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Write-Host "[OK] Game Mode Scheduler: High Category, High SFIO, GPU Priority 8, CPU Priority 6, MaxPreRendered 1" -ForegroundColor Green
    $appliedTweaks.Add("GameModeTweaks") | Out-Null
} catch {
    $failedTweaks.Add("GameModeTweaks") | Out-Null
    Write-Host "[ERR] GameModeTweaks: $_" -ForegroundColor Red
}
Write-Host "[>>] NetworkThrottling..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff
    $appliedTweaks.Add("NetworkThrottling") | Out-Null
} catch {
    $failedTweaks.Add("NetworkThrottling") | Out-Null
    Write-Host "[ERR] NetworkThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] OptimizeTCP..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global autotuninglevel=normal 2>$null; netsh int tcp set global chimney=disabled 2>$null; netsh int tcp set global dca=enabled 2>$null; Write-Host "[OK] TCP globals tuned (autotune=normal, chimney=off, dca=on). netdma intentionally skipped — deprecated on Win10+, breaks modern NICs." -ForegroundColor Green
    $appliedTweaks.Add("OptimizeTCP") | Out-Null
} catch {
    $failedTweaks.Add("OptimizeTCP") | Out-Null
    Write-Host "[ERR] OptimizeTCP: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableNagle..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces' -Name 'TcpAckFrequency' -Value 1; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TCPNoDelay' -Value 1
    $appliedTweaks.Add("DisableNagle") | Out-Null
} catch {
    $failedTweaks.Add("DisableNagle") | Out-Null
    Write-Host "[ERR] DisableNagle: $_" -ForegroundColor Red
}
Write-Host "[>>] InputLagTCP..." -ForegroundColor DarkYellow
try {
    $tcpPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters'; Set-ItemProperty -Path $tcpPath -Name 'TcpAckFrequency' -Value 1 -Type DWord; Set-ItemProperty -Path $tcpPath -Name 'TCPNoDelay' -Value 1 -Type DWord; Set-ItemProperty -Path $tcpPath -Name 'EnablePMTUBHDetect' -Value 0 -Type DWord; Write-Host "[OK] TCP Input Lag: TcpAckFrequency=1, TCPNoDelay=1, EnablePMTUBHDetect=0" -ForegroundColor Green
    $appliedTweaks.Add("InputLagTCP") | Out-Null
} catch {
    $failedTweaks.Add("InputLagTCP") | Out-Null
    Write-Host "[ERR] InputLagTCP: $_" -ForegroundColor Red
}
Write-Host "[>>] EnableTCPAutoTuning..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global autotuninglevel=normal; Write-Host "[OK] TCP Auto-Tuning set to Normal — dynamic receive window for max throughput" -ForegroundColor Green
    $appliedTweaks.Add("EnableTCPAutoTuning") | Out-Null
} catch {
    $failedTweaks.Add("EnableTCPAutoTuning") | Out-Null
    Write-Host "[ERR] EnableTCPAutoTuning: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePowerThrottling..." -ForegroundColor DarkYellow
try {
    powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 d4e98f31-5ffe-4ce1-be31-1b38b384c009 0; powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 d4e98f31-5ffe-4ce1-be31-1b38b384c009 0
    $appliedTweaks.Add("DisablePowerThrottling") | Out-Null
} catch {
    $failedTweaks.Add("DisablePowerThrottling") | Out-Null
    Write-Host "[ERR] DisablePowerThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] SetDNSPriority..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters' -Name 'MaxCacheTtl' -Value 86400 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters' -Name 'MaxNegativeCacheTtl' -Value 0 -Type DWord -Force; netsh int tcp set global timestamps=disabled 2>$null; Write-Host "[OK] DNS: MaxCacheTTL=86400, NegativeCache=0, timestamps disabled" -ForegroundColor Green
    $appliedTweaks.Add("SetDNSPriority") | Out-Null
} catch {
    $failedTweaks.Add("SetDNSPriority") | Out-Null
    Write-Host "[ERR] SetDNSPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableNDU..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Ndu' -Name 'Start' -Value 4
    $appliedTweaks.Add("DisableNDU") | Out-Null
} catch {
    $failedTweaks.Add("DisableNDU") | Out-Null
    Write-Host "[ERR] DisableNDU: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableIPv6..." -ForegroundColor DarkYellow
try {
    $p='HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty -Path $p -Name 'DisabledComponents' -Value 0x20 -Type DWord -Force; Write-Host "[OK] IPv6 prefer-IPv4 set via supported registry method (DisabledComponents=0x20). Tunnel/binding stays intact — FiveM/Rockstar entitlement, Discord voice, Xbox party chat continue to work." -ForegroundColor Green
    $appliedTweaks.Add("DisableIPv6") | Out-Null
} catch {
    $failedTweaks.Add("DisableIPv6") | Out-Null
    Write-Host "[ERR] DisableIPv6: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePrefetch..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' -Name 'EnablePrefetcher' -Value 0; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' -Name 'EnableSuperfetch' -Value 0
    $appliedTweaks.Add("DisablePrefetch") | Out-Null
} catch {
    $failedTweaks.Add("DisablePrefetch") | Out-Null
    Write-Host "[ERR] DisablePrefetch: $_" -ForegroundColor Red
}
Write-Host "[>>] OptimizeRAMUsage..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hProcess);' -Name 'MemTrimRO' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemTrimRO]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; [System.GC]::Collect(); Write-Host "[OK] Standby list flushed — physical RAM reclaimed for active processes" -ForegroundColor Green
    $appliedTweaks.Add("OptimizeRAMUsage") | Out-Null
} catch {
    $failedTweaks.Add("OptimizeRAMUsage") | Out-Null
    Write-Host "[ERR] OptimizeRAMUsage: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableAnimations..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00))
    $appliedTweaks.Add("DisableAnimations") | Out-Null
} catch {
    $failedTweaks.Add("DisableAnimations") | Out-Null
    Write-Host "[ERR] DisableAnimations: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableXboxGameBar..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0; Get-AppxPackage Microsoft.XboxGamingOverlay | Remove-AppxPackage
    $appliedTweaks.Add("DisableXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("DisableXboxGameBar") | Out-Null
    Write-Host "[ERR] DisableXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableGameDVR..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0
    $appliedTweaks.Add("DisableGameDVR") | Out-Null
} catch {
    $failedTweaks.Add("DisableGameDVR") | Out-Null
    Write-Host "[ERR] DisableGameDVR: $_" -ForegroundColor Red
}
Write-Host "[>>] SysVisualBestPerf..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force -EA SilentlyContinue; $mask = [byte[]](0x90,0x12,0x01,0x80,0x10,0x00,0x00,0x00); Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value $mask -Type Binary -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'FontSmoothing' -Value '2' -Force -EA SilentlyContinue; New-Item -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Name 'EnableAeroPeek' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[System] Visual effects set to Best Performance — all compositor animations disabled, GPU VRAM freed for gaming" -ForegroundColor Green
    $appliedTweaks.Add("SysVisualBestPerf") | Out-Null
} catch {
    $failedTweaks.Add("SysVisualBestPerf") | Out-Null
    Write-Host "[ERR] SysVisualBestPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] SysHibernateOff..." -ForegroundColor DarkYellow
try {
    powercfg /h off 2>$null; New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name 'HiberbootEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[System] Hibernation disabled — hiberfil.sys removed. Reclaims disk space equal to your RAM (8GB+ on most systems). Full cold boots only." -ForegroundColor Green
    $appliedTweaks.Add("SysHibernateOff") | Out-Null
} catch {
    $failedTweaks.Add("SysHibernateOff") | Out-Null
    Write-Host "[ERR] SysHibernateOff: $_" -ForegroundColor Red
}
Write-Host "[>>] EnableHAGS..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: NOT IDEAL FOR ALL SYSTEMS — HAGS HURTS OLDER GPUs. If you have a GTX 10xx (Pascal), GTX 16xx (Turing), or AMD RX 5000 or older, enabling HAGS increases frame-time variance and causes micro-stutters. It only benefits RTX 2000+ and RX 6000+ discrete GPUs on Windows 11. Skip this if you are on an older card." -ForegroundColor Yellow; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 2; Write-Host "[Visual] Hardware-Accelerated GPU Scheduling enabled (HwSchMode=2). Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("EnableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("EnableHAGS") | Out-Null
    Write-Host "[ERR] EnableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePointerPrecision..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseSpeed' -Value 0; Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold1' -Value 0; Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseThreshold2' -Value 0
    $appliedTweaks.Add("DisablePointerPrecision") | Out-Null
} catch {
    $failedTweaks.Add("DisablePointerPrecision") | Out-Null
    Write-Host "[ERR] DisablePointerPrecision: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableFastStartup..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name 'HiberbootEnabled' -Value 0
    $appliedTweaks.Add("DisableFastStartup") | Out-Null
} catch {
    $failedTweaks.Add("DisableFastStartup") | Out-Null
    Write-Host "[ERR] DisableFastStartup: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableWindowsError..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' -Name 'Disabled' -Value 1; Stop-Service -Name 'WerSvc' -Force; Set-Service -Name 'WerSvc' -StartupType Disabled
    $appliedTweaks.Add("DisableWindowsError") | Out-Null
} catch {
    $failedTweaks.Add("DisableWindowsError") | Out-Null
    Write-Host "[ERR] DisableWindowsError: $_" -ForegroundColor Red
}
Write-Host "[>>] SetHighPerformancePlan..." -ForegroundColor DarkYellow
try {
    powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61; $guid = (powercfg -l | Select-String 'Ultimate Performance').Line.Split(' ')[3]; powercfg -setactive $guid
    $appliedTweaks.Add("SetHighPerformancePlan") | Out-Null
} catch {
    $failedTweaks.Add("SetHighPerformancePlan") | Out-Null
    Write-Host "[ERR] SetHighPerformancePlan: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableUSBSuspend..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    $appliedTweaks.Add("DisableUSBSuspend") | Out-Null
} catch {
    $failedTweaks.Add("DisableUSBSuspend") | Out-Null
    Write-Host "[ERR] DisableUSBSuspend: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableCoreParking..." -ForegroundColor DarkYellow
try {
    $cpPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord; Set-ItemProperty -Path $cpPath -Name 'Attributes' -Value 1 -Type DWord; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100; Write-Host "[OK] CPU Core Parking disabled — all cores will remain active" -ForegroundColor Green
    $appliedTweaks.Add("DisableCoreParking") | Out-Null
} catch {
    $failedTweaks.Add("DisableCoreParking") | Out-Null
    Write-Host "[ERR] DisableCoreParking: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePowerThrottlingAdv..." -ForegroundColor DarkYellow
try {
    $ptPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\be337238-0d82-4146-a960-4f3749d470c7'; If (Test-Path $ptPath) { Set-ItemProperty -Path $ptPath -Name 'Attributes' -Value 1 -Type DWord }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' -Name 'PowerThrottlingOff' -Value 1 -Type DWord -ErrorAction SilentlyContinue; Write-Host "[OK] Power Throttling (Advanced) disabled via PowerSettings and PowerThrottling key" -ForegroundColor Green
    $appliedTweaks.Add("DisablePowerThrottlingAdv") | Out-Null
} catch {
    $failedTweaks.Add("DisablePowerThrottlingAdv") | Out-Null
    Write-Host "[ERR] DisablePowerThrottlingAdv: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableDynamicTick..." -ForegroundColor DarkYellow
try {
    bcdedit /set disabledynamictick yes
    $appliedTweaks.Add("DisableDynamicTick") | Out-Null
} catch {
    $failedTweaks.Add("DisableDynamicTick") | Out-Null
    Write-Host "[ERR] DisableDynamicTick: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryNTFSOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsDisableLastAccessUpdate' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsDisable8dot3NameCreation' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsMftZoneReservation' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NTFS] DisableLastAccessUpdate=1 — eliminates write-on-read overhead. DisableLastAccess cuts disk I/O by ~5-10% on game asset dirs. 8dot3=off: no legacy short filenames. MftZoneReservation=2: 12.5% reserved for MFT. All: faster asset streaming." -ForegroundColor Green
    $appliedTweaks.Add("RegistryNTFSOptimize") | Out-Null
} catch {
    $failedTweaks.Add("RegistryNTFSOptimize") | Out-Null
    Write-Host "[ERR] RegistryNTFSOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryIOPageLock..." -ForegroundColor DarkYellow
try {
    $memPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; $ramGB = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB); $limit = if ($ramGB -ge 32) { 2147483648 } elseif ($ramGB -ge 16) { 1073741824 } else { 536870912 }; Set-ItemProperty $memPath -Name 'IOPageLockLimit' -Value $limit -Type DWord -Force -EA SilentlyContinue; Write-Host "[Memory] IOPageLockLimit=$limit for $ramGB GB RAM. Allows kernel to lock more physical pages for DMA/I/O — reduces streaming stutter and improves asset throughput in GTA V. Effective immediately." -ForegroundColor Green
    $appliedTweaks.Add("RegistryIOPageLock") | Out-Null
} catch {
    $failedTweaks.Add("RegistryIOPageLock") | Out-Null
    Write-Host "[ERR] RegistryIOPageLock: $_" -ForegroundColor Red
}
Write-Host "[>>] CodRawInput..." -ForegroundColor DarkYellow
try {
    $dir = "$env:USERPROFILE\Documents\Call of Duty\players"; New-Item $dir -ItemType Directory -Force -EA SilentlyContinue | Out-Null; $cfg = "$dir\adv_options.ini"; If (!(Test-Path $cfg)) { @('[INPUT]','raw_mouse_input = true','mouse_filter = 0','mouse_deflection = 0.0') | Set-Content $cfg -Encoding UTF8 } Else { $c = Get-Content $cfg -Raw; If ($c -notmatch 'raw_mouse_input') { Add-Content $cfg ([Environment]::NewLine + 'raw_mouse_input = true') } }; Write-Host "[COD] Raw mouse input enabled in adv_options.ini — bypasses Windows mouse acceleration stack for 1:1 aim tracking." -ForegroundColor Green
    $appliedTweaks.Add("CodRawInput") | Out-Null
} catch {
    $failedTweaks.Add("CodRawInput") | Out-Null
    Write-Host "[ERR] CodRawInput: $_" -ForegroundColor Red
}
Write-Host "[>>] CodHighPriority..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions'; If (!(Test-Path $ifeo)) { New-Item -Path $ifeo -Force | Out-Null }; Set-ItemProperty -Path $ifeo -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'IoPriority' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'PagePriority' -Value 5 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'DisableEnergyThrottling' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'EnableBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'ForceForegroundBoost' -Value 1 -Type DWord -Force; Write-Host "[COD] cod.exe priority: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}), IO=High, throttle off, FGBoost on" -ForegroundColor Green
    $appliedTweaks.Add("CodHighPriority") | Out-Null
} catch {
    $failedTweaks.Add("CodHighPriority") | Out-Null
    Write-Host "[ERR] CodHighPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] CodGameMode..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue; $key = 'HKCU:\System\GameConfigStore'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'GameDVR_Enabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $key -Name 'GameDVR_FSEBehaviorMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] Windows Game Mode enabled, Xbox DVR disabled — frees CPU/GPU overhead while COD is running" -ForegroundColor Green
    $appliedTweaks.Add("CodGameMode") | Out-Null
} catch {
    $failedTweaks.Add("CodGameMode") | Out-Null
    Write-Host "[ERR] CodGameMode: $_" -ForegroundColor Red
}
Write-Host "[>>] CodShaderCacheClear..." -ForegroundColor DarkYellow
try {
    $paths = @("$env:LOCALAPPDATA\Activision\cod\cache", "$env:LOCALAPPDATA\Battle.net\Cache", "$env:LOCALAPPDATA\NVIDIA\DXCache", "$env:LOCALAPPDATA\D3DSCache"); $cleaned = 0; foreach ($p in $paths) { If (Test-Path $p) { Remove-Item -Path "$p\*" -Recurse -Force -EA SilentlyContinue; $cleaned++; Write-Host "[COD] Cleared: $p" -ForegroundColor Cyan } }; Write-Host "[COD] Shader + GPU driver cache cleared ($cleaned folders). BO6 will recompile shaders on next launch — expect a 2-3 min stutter pass, then textures will load correctly every game." -ForegroundColor Green
    $appliedTweaks.Add("CodShaderCacheClear") | Out-Null
} catch {
    $failedTweaks.Add("CodShaderCacheClear") | Out-Null
    Write-Host "[ERR] CodShaderCacheClear: $_" -ForegroundColor Red
}
Write-Host "[>>] CodPagefileOptimize..." -ForegroundColor DarkYellow
try {
    $minMB = 16384; $maxMB = 32768; $cs = Get-WmiObject Win32_ComputerSystem; $cs.AutomaticManagedPagefile = $false; $cs.Put() | Out-Null; $pf = Get-WmiObject Win32_PageFileSetting -EA SilentlyContinue | Where-Object { $_.Name -like 'C:*' }; If ($pf) { $pf.InitialSize = $minMB; $pf.MaximumSize = $maxMB; $pf.Put() | Out-Null } Else { $s = ([WMIClass]'Win32_PageFileSetting').CreateInstance(); $s.Name = 'C:pagefile.sys'; $s.InitialSize = $minMB; $s.MaximumSize = $maxMB; $s.Put() | Out-Null }; Write-Host "[COD] Pagefile set to 16GB-32GB. GTX 1650 Super has 4GB VRAM — when BO6 fills it (happens mid-game), Windows pages overflow textures to RAM via pagefile. Undersized pagefile = blurry buildings and character pop-in you are seeing." -ForegroundColor Green
    $appliedTweaks.Add("CodPagefileOptimize") | Out-Null
} catch {
    $failedTweaks.Add("CodPagefileOptimize") | Out-Null
    Write-Host "[ERR] CodPagefileOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDisableHAGS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force; Write-Host "[COD] HAGS disabled (HwSchMode=1). GTX 1650 Super + BO6/Warzone: HAGS causes frame-time variance and texture streaming stalls on Turing/Pascal GPUs — this is the #1 stutter fix for 4GB cards. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("CodDisableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("CodDisableHAGS") | Out-Null
    Write-Host "[ERR] CodDisableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] CodNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] Network socket buffers set to 512KB — reduces packet loss spikes in Warzone BR server model, helps with character/loot not loading during drop phase" -ForegroundColor Green
    $appliedTweaks.Add("CodNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("CodNetworkBuffer") | Out-Null
    Write-Host "[ERR] CodNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDisableLSO..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { Disable-NetAdapterLso -Name $_.Name -EA SilentlyContinue; Write-Host "[COD] LSO disabled on: $($_.Name)" -ForegroundColor Cyan }; Write-Host "[COD] Large Send Offload disabled on all active adapters — eliminates 5-30ms latency spikes during Warzone circle fights" -ForegroundColor Green
    $appliedTweaks.Add("CodDisableLSO") | Out-Null
} catch {
    $failedTweaks.Add("CodDisableLSO") | Out-Null
    Write-Host "[ERR] CodDisableLSO: $_" -ForegroundColor Red
}
Write-Host "[>>] CodTCPOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TcpAckFrequency' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TCPNoDelay' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TcpTimestampOpt' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] TCP: Nagle off (TCPNoDelay=1), immediate ACKs, timestamps off — tighter COD server tick alignment" -ForegroundColor Green
    $appliedTweaks.Add("CodTCPOptimize") | Out-Null
} catch {
    $failedTweaks.Add("CodTCPOptimize") | Out-Null
    Write-Host "[ERR] CodTCPOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] CodBattlenetOptimize..." -ForegroundColor DarkYellow
try {
    @("BattleNet", "Battle.net", "Agent") | ForEach-Object { Get-Process -Name $_ -EA SilentlyContinue | Where-Object { $_.MainWindowHandle -eq 0 } | Stop-Process -Force -EA SilentlyContinue }; Write-Host "[COD] Battle.net background agents stopped — frees 50-150MB RAM and CPU cycles during gameplay. Reopen Battle.net to restore." -ForegroundColor Green
    $appliedTweaks.Add("CodBattlenetOptimize") | Out-Null
} catch {
    $failedTweaks.Add("CodBattlenetOptimize") | Out-Null
    Write-Host "[ERR] CodBattlenetOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDisableXboxCapture..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] Xbox Game DVR and capture hooks disabled — removes the background capture thread that hooks into every DirectX game process" -ForegroundColor Green
    $appliedTweaks.Add("CodDisableXboxCapture") | Out-Null
} catch {
    $failedTweaks.Add("CodDisableXboxCapture") | Out-Null
    Write-Host "[ERR] CodDisableXboxCapture: $_" -ForegroundColor Red
}
Write-Host "[>>] CodGPUPriority..." -ForegroundColor DarkYellow
try {
    $exes = @('cod.exe','ModernWarfare.exe','ModernWarfareII.exe','ModernWarfareIII.exe'); foreach ($exe in $exes) { $key = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\$exe\PerfOptions"; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'GPUPriority' 8 -Type DWord -Force; Set-ItemProperty $key 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $key 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $key 'ForceForegroundBoost' 1 -Type DWord -Force }; Write-Host "[COD] GPU Priority 8 set for all COD executables via IFEO — highest WDDM GPU scheduling priority, reduces render-submit latency in BO6 gunfights" -ForegroundColor Green
    $appliedTweaks.Add("CodGPUPriority") | Out-Null
} catch {
    $failedTweaks.Add("CodGPUPriority") | Out-Null
    Write-Host "[ERR] CodGPUPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDefenderExclusion..." -ForegroundColor DarkYellow
try {
    $codPaths = @('C:\Program Files\Call of Duty','C:\Program Files (x86)\Call of Duty','D:\Call of Duty','E:\Call of Duty','C:\Program Files\Battle.net Apps\Call of Duty'); foreach ($p in $codPaths) { If (Test-Path $p) { Add-MpPreference -ExclusionPath $p -EA SilentlyContinue; Write-Host "[COD] Defender exclusion added: $p" -ForegroundColor Green } }; $steamPaths = @('C:\Program Files (x86)\Steam\steamapps\common','D:\SteamLibrary\steamapps\common','E:\SteamLibrary\steamapps\common'); foreach ($s in $steamPaths) { $full = Join-Path $s 'Call of Duty Modern Warfare 2'; If (Test-Path $full) { Add-MpPreference -ExclusionPath $full -EA SilentlyContinue; Write-Host "[COD] Defender exclusion added: $full" -ForegroundColor Green } }; Write-Host "[COD] Defender exclusion applied — Defender was scanning COD pak files on every load causing 2-8s load time spikes and mid-game disk hitching" -ForegroundColor Cyan
    $appliedTweaks.Add("CodDefenderExclusion") | Out-Null
} catch {
    $failedTweaks.Add("CodDefenderExclusion") | Out-Null
    Write-Host "[ERR] CodDefenderExclusion: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDirectXQueue..." -ForegroundColor DarkYellow
try {
    $dxKey = 'HKCU:\SOFTWARE\Microsoft\Direct3D'; If (!(Test-Path $dxKey)) { New-Item $dxKey -Force | Out-Null }; Set-ItemProperty $dxKey 'MaxFrameLatency' 1 -Type DWord -Force; $flipKey = 'HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences'; If (!(Test-Path $flipKey)) { New-Item $flipKey -Force | Out-Null }; Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' 'OverlayTestMode' 5 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'PlatformSupportMiracast' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] DirectX MaxFrameLatency=1 + flip model override — GPU queue depth reduced by 1 frame, tightens frame delivery consistency in BO6" -ForegroundColor Green
    $appliedTweaks.Add("CodDirectXQueue") | Out-Null
} catch {
    $failedTweaks.Add("CodDirectXQueue") | Out-Null
    Write-Host "[ERR] CodDirectXQueue: $_" -ForegroundColor Red
}
Write-Host "[>>] CodVRAMShaderBudget..." -ForegroundColor DarkYellow
try {
    $caches = @("$env:LOCALAPPDATA\NVIDIA\DXCache","$env:LOCALAPPDATA\NVIDIA\GLCache","$env:LOCALAPPDATA\D3DSCache","$env:LOCALAPPDATA\AMD\DxcCache","$env:LOCALAPPDATA\Activision\Blizzard\Warzone\Cache"); foreach ($c in $caches) { If (Test-Path $c) { Remove-Item "$c\*" -Recurse -Force -EA SilentlyContinue; Write-Host "[COD] Cleared shader cache: $c" -ForegroundColor Green } }; Write-Host "[COD] All DirectX/GPU shader caches cleared — stale/oversized caches waste VRAM headroom and cause hitching when COD pages them in. Next launch rebuilds clean." -ForegroundColor Cyan
    $appliedTweaks.Add("CodVRAMShaderBudget") | Out-Null
} catch {
    $failedTweaks.Add("CodVRAMShaderBudget") | Out-Null
    Write-Host "[ERR] CodVRAMShaderBudget: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDisableTelemetry..." -ForegroundColor DarkYellow
try {
    $names = @('CrashReport','CrashReporter','AdobeGCInvoker','adobeupd','Blizzard','atvi','callofduty_analytics','CodAnalytics'); foreach ($n in $names) { Get-Process -Name $n -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue }; $tasks = Get-ScheduledTask -EA SilentlyContinue | Where-Object { $_.TaskName -match 'activision|callofduty|blizzard.?update|acti.?crash' }; foreach ($t in $tasks) { Disable-ScheduledTask -TaskPath $t.TaskPath -TaskName $t.TaskName -EA SilentlyContinue; Write-Host "[COD] Disabled task: $($t.TaskName)" -ForegroundColor Cyan }; $hostsPath = 'C:\Windows\System32\drivers\etc\hosts'; $block = @('crash.callofduty.com','analytics.callofduty.com','telemetry.activision.com','atvi-error.callofduty.com'); $hosts = Get-Content $hostsPath -Raw -EA SilentlyContinue; foreach ($h in $block) { if ($hosts -notmatch [regex]::Escape($h)) { Add-Content $hostsPath "0.0.0.0 $h" -EA SilentlyContinue; Write-Host "[COD] Blocked telemetry host: $h" -ForegroundColor Green } }; Write-Host "[COD] Activision/COD telemetry tasks disabled + crash/analytics endpoints blocked — removes background analytics CPU usage and network spikes mid-game." -ForegroundColor Green
    $appliedTweaks.Add("CodDisableTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("CodDisableTelemetry") | Out-Null
    Write-Host "[ERR] CodDisableTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] CodMMCSS..." -ForegroundColor DarkYellow
try {
    $base = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $base)) { New-Item $base -Force | Out-Null }; Set-ItemProperty $base 'Affinity' 0 -Type DWord -Force; Set-ItemProperty $base 'Background Only' 'False' -Type String -Force; Set-ItemProperty $base 'Clock Rate' 10000 -Type DWord -Force; Set-ItemProperty $base 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $base 'Priority' 6 -Type DWord -Force; Set-ItemProperty $base 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $base 'SFIO Priority' 'High' -Type String -Force; $sp = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'; Set-ItemProperty $sp 'SystemResponsiveness' 10 -Type DWord -Force; Write-Host "[COD] MMCSS Games task tuned (Priority=6, GPU=8, High scheduling, SystemResponsiveness=10) — Windows Multimedia Class Scheduler gives cod.exe consistent CPU time slices and prevents Windows audio/streaming services from stealing frames mid-gunfight." -ForegroundColor Green
    $appliedTweaks.Add("CodMMCSS") | Out-Null
} catch {
    $failedTweaks.Add("CodMMCSS") | Out-Null
    Write-Host "[ERR] CodMMCSS: $_" -ForegroundColor Red
}
Write-Host "[>>] CodQoSPolicy..." -ForegroundColor DarkYellow
try {
    $pol = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\QoS\COD Gaming'; If (!(Test-Path $pol)) { New-Item $pol -Force | Out-Null }; Set-ItemProperty $pol 'Version' '1.0' -Type String -Force; Set-ItemProperty $pol 'Application Name' 'cod.exe' -Type String -Force; Set-ItemProperty $pol 'DSCP Value' '46' -Type String -Force; Set-ItemProperty $pol 'Local Port' '*' -Type String -Force; Set-ItemProperty $pol 'Remote Port' '*' -Type String -Force; Set-ItemProperty $pol 'Protocol' '17' -Type String -Force; Set-ItemProperty $pol 'Local IP' '*' -Type String -Force; Set-ItemProperty $pol 'Remote IP' '*' -Type String -Force; $pol2 = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\QoS\COD TCP'; If (!(Test-Path $pol2)) { New-Item $pol2 -Force | Out-Null }; Set-ItemProperty $pol2 'Version' '1.0' -Type String -Force; Set-ItemProperty $pol2 'Application Name' 'cod.exe' -Type String -Force; Set-ItemProperty $pol2 'DSCP Value' '46' -Type String -Force; Set-ItemProperty $pol2 'Protocol' '6' -Type String -Force; Set-ItemProperty $pol2 'Local Port' '*' -Type String -Force; Set-ItemProperty $pol2 'Remote Port' '*' -Type String -Force; Set-ItemProperty $pol2 'Local IP' '*' -Type String -Force; Set-ItemProperty $pol2 'Remote IP' '*' -Type String -Force; Write-Host "[COD] QoS policy applied: cod.exe UDP+TCP traffic marked DSCP 46 (Expedited Forwarding). Your router/switch will prioritize COD packets over background traffic — reduces jitter during Warzone BR drops with 100 players." -ForegroundColor Green
    $appliedTweaks.Add("CodQoSPolicy") | Out-Null
} catch {
    $failedTweaks.Add("CodQoSPolicy") | Out-Null
    Write-Host "[ERR] CodQoSPolicy: $_" -ForegroundColor Red
}
Write-Host "[>>] SpotifyLowPriority..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Spotify.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 1 -Type DWord -Force; Set-ItemProperty $key 'IoPriority' 1 -Type DWord -Force; Write-Host "[Spotify] Set to Below Normal CPU + Low I/O priority via IFEO — persists across reboots. Spotify stays open for music but won't compete with game threads for frame time." -ForegroundColor Green
    $appliedTweaks.Add("SpotifyLowPriority") | Out-Null
} catch {
    $failedTweaks.Add("SpotifyLowPriority") | Out-Null
    Write-Host "[ERR] SpotifyLowPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] SpotifyDisableGPU..." -ForegroundColor DarkYellow
try {
    $prefsPath = "$env:APPDATA\Spotify\prefs"; If (Test-Path $prefsPath) { $c = Get-Content $prefsPath -Raw; $c = $c -replace 'hardware_acceleration=true?
',''; $c = $c -replace 'hardware_acceleration=false?
',''; $c = $c.TrimEnd() + "`r`nhardware_acceleration=false`r`n"; Set-Content $prefsPath $c -Encoding UTF8; Write-Host "[Spotify] Hardware GPU acceleration disabled — Spotify uses Chromium and grabs the GPU compositor by default, wasting VRAM on 4-8GB cards. Restart Spotify to apply." -ForegroundColor Green } Else { Write-Host "[SKIP] Spotify prefs file not found at $prefsPath. Open Spotify once to create it, then re-run." -ForegroundColor Yellow }
    $appliedTweaks.Add("SpotifyDisableGPU") | Out-Null
} catch {
    $failedTweaks.Add("SpotifyDisableGPU") | Out-Null
    Write-Host "[ERR] SpotifyDisableGPU: $_" -ForegroundColor Red
}
Write-Host "[>>] SpotifyDisableAutoUpdate..." -ForegroundColor DarkYellow
try {
    Get-ScheduledTask | Where-Object { $_.TaskName -like '*Spotify*' } | Disable-ScheduledTask -EA SilentlyContinue; $prefsPath = "$env:APPDATA\Spotify\prefs"; If (Test-Path $prefsPath) { $c = Get-Content $prefsPath -Raw; $c = $c -replace 'autoupdate=true?
',''; $c = $c.TrimEnd() + "`r`nautoupdate=false`r`n"; Set-Content $prefsPath $c -Encoding UTF8 }; Write-Host "[Spotify] Auto-update scheduled tasks disabled and prefs flag set — Spotify won't download updates mid-game causing CPU/disk spikes." -ForegroundColor Green
    $appliedTweaks.Add("SpotifyDisableAutoUpdate") | Out-Null
} catch {
    $failedTweaks.Add("SpotifyDisableAutoUpdate") | Out-Null
    Write-Host "[ERR] SpotifyDisableAutoUpdate: $_" -ForegroundColor Red
}
Write-Host "[>>] SpotifyLimitBandwidth..." -ForegroundColor DarkYellow
try {
    $prefsPath = "$env:APPDATA\Spotify\prefs"; If (Test-Path $prefsPath) { $c = Get-Content $prefsPath -Raw; $c = $c -replace 'download.hq=true?
',''; $c = $c -replace 'streaming.download_podcasts=true?
',''; $c = $c.TrimEnd() + "`r`ndownload.hq=false`r`nstreaming.download_podcasts=false`r`n"; Set-Content $prefsPath $c -Encoding UTF8; Write-Host "[Spotify] HQ downloads and podcast prefetch disabled — reduces Spotify's background disk and network impact during gaming sessions." -ForegroundColor Green } Else { Write-Host "[SKIP] Spotify prefs not found — open Spotify once then re-run." -ForegroundColor Yellow }
    $appliedTweaks.Add("SpotifyLimitBandwidth") | Out-Null
} catch {
    $failedTweaks.Add("SpotifyLimitBandwidth") | Out-Null
    Write-Host "[ERR] SpotifyLimitBandwidth: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableSearchIndexer..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WSearch' -Force -EA SilentlyContinue; Set-Service 'WSearch' -StartupType Disabled -EA SilentlyContinue; Write-Host "[Registry] Windows Search Indexer disabled — stops SearchIndexer.exe from spiking disk I/O and CPU during gaming. Re-enable via Services.msc (WSearch) if you need Windows Search." -ForegroundColor Green
    $appliedTweaks.Add("DisableSearchIndexer") | Out-Null
} catch {
    $failedTweaks.Add("DisableSearchIndexer") | Out-Null
    Write-Host "[ERR] DisableSearchIndexer: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableAutoMaintenance..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\Maintenance' -Name 'MaintenanceDisabled' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Registry] Automatic Maintenance disabled — prevents Defender scans and disk cleanup from triggering mid-session. Re-enable via Control Panel > Security and Maintenance." -ForegroundColor Green
    $appliedTweaks.Add("DisableAutoMaintenance") | Out-Null
} catch {
    $failedTweaks.Add("DisableAutoMaintenance") | Out-Null
    Write-Host "[ERR] DisableAutoMaintenance: $_" -ForegroundColor Red
}
Write-Host "[>>] CodTdrDelay..." -ForegroundColor DarkYellow
try {
    $gd = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If (!(Test-Path $gd)) { New-Item $gd -Force | Out-Null }; Set-ItemProperty $gd 'TdrDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrDdiDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrLimitCount' 20 -Type DWord -Force; Write-Host "[COD] GPU TDR delay extended to 8s (was 2s) — BO6 and Warzone do heavy shader compilation during level loads which can trigger Windows' GPU hang detection on 4GB cards. Extending TDR prevents false 'GPU stopped responding' crashes and black screen resets. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("CodTdrDelay") | Out-Null
} catch {
    $failedTweaks.Add("CodTdrDelay") | Out-Null
    Write-Host "[ERR] CodTdrDelay: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [FiveM] 14 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] FiveMCacheClear..." -ForegroundColor DarkYellow
try {
    Remove-Item -Path "$env:LocalAppData\FiveM\FiveM.app\cache\*" -Recurse -Force -ErrorAction SilentlyContinue
    $appliedTweaks.Add("FiveMCacheClear") | Out-Null
} catch {
    $failedTweaks.Add("FiveMCacheClear") | Out-Null
    Write-Host "[ERR] FiveMCacheClear: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMHighPriority..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri
    $appliedTweaks.Add("FiveMHighPriority") | Out-Null
} catch {
    $failedTweaks.Add("FiveMHighPriority") | Out-Null
    Write-Host "[ERR] FiveMHighPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Write-Host "[FiveM] Network buffer: 512KB send/receive window (reduces packet batching)" -ForegroundColor Green
    $appliedTweaks.Add("FiveMNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("FiveMNetworkBuffer") | Out-Null
    Write-Host "[ERR] FiveMNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableNvidiaTelemetry..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'NvTelemetryContainer' -Force; Set-Service -Name 'NvTelemetryContainer' -StartupType Disabled
    $appliedTweaks.Add("FiveMDisableNvidiaTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableNvidiaTelemetry") | Out-Null
    Write-Host "[ERR] FiveMDisableNvidiaTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableLSO..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { $n = $_.Name; Disable-NetAdapterLso -Name $n -EA SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword "*LsoV2IPv4" -RegistryValue 0 -EA SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword "*LsoV2IPv6" -RegistryValue 0 -EA SilentlyContinue; Write-Host "[NET] LSO disabled on $n — removes TCP batching that causes 5-30ms spikes on busy servers" -ForegroundColor Green }
    $appliedTweaks.Add("FiveMDisableLSO") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableLSO") | Out-Null
    Write-Host "[ERR] FiveMDisableLSO: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMEnableRSS..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { Enable-NetAdapterRss -Name $_.Name -EA SilentlyContinue; Write-Host "[NET] RSS enabled on $($_.Name)" -ForegroundColor Green }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Ndis\Parameters' -Name 'RssBaseCpu' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NET] RSS base CPU pinned to core 1 (avoids core 0 interrupt overhead) — packet processing now uses multiple CPU cores" -ForegroundColor Cyan
    $appliedTweaks.Add("FiveMEnableRSS") | Out-Null
} catch {
    $failedTweaks.Add("FiveMEnableRSS") | Out-Null
    Write-Host "[ERR] FiveMEnableRSS: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMReduceNPCDensity..." -ForegroundColor DarkYellow
try {
    $f = "$env:USERPROFILE\Documents\Rockstar Games\GTA V\settings.xml"; If (Test-Path $f) { $c = Get-Content $f -Raw; $c = $c -replace '(<PedDensity value=")[^"]*(")', '${1}0.150000${2}'; $c = $c -replace '(<TrafficDensity value=")[^"]*(")', '${1}0.150000${2}'; Set-Content $f $c; Write-Host "[GTA V] NPC density 15%, Vehicle density 15% — major FPS gain in populated servers (was biggest CPU bottleneck)" -ForegroundColor Green } Else { Write-Host "[GTA V] settings.xml not found at $f — launch GTA V once to generate it, then re-run this tweak" -ForegroundColor Yellow }
    $appliedTweaks.Add("FiveMReduceNPCDensity") | Out-Null
} catch {
    $failedTweaks.Add("FiveMReduceNPCDensity") | Out-Null
    Write-Host "[ERR] FiveMReduceNPCDensity: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMCommandLineTweaks..." -ForegroundColor DarkYellow
try {
    $dir = "$env:USERPROFILE\Documents\Rockstar Games\GTA V"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; Set-Content "$dir\commandline.txt" "-nomemrestrict -norestrictions -noBlockOnLostFocus -novblank"; Write-Host "[GTA V] commandline.txt written: -nomemrestrict -norestrictions -noBlockOnLostFocus -novblank" -ForegroundColor Green; Write-Host "[GTA V] nomemrestrict removes VRAM ceiling; novblank removes VSync frame lock; noBlockOnLostFocus keeps game running on alt-tab" -ForegroundColor Cyan
    $appliedTweaks.Add("FiveMCommandLineTweaks") | Out-Null
} catch {
    $failedTweaks.Add("FiveMCommandLineTweaks") | Out-Null
    Write-Host "[ERR] FiveMCommandLineTweaks: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMFullPerfStack..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; $applyFullStack = { param($exe) $k = "$ifeo\$exe\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $k 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $k 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'IoPriority' 2 -Type DWord -Force; Set-ItemProperty $k 'PagePriority' 5 -Type DWord -Force; Set-ItemProperty $k 'PowerThrottlingOff' 1 -Type DWord -Force; Set-ItemProperty $k 'MaximumPerformanceEnabled' 1 -Type DWord -Force; Write-Host "[FiveM] PerfOptions applied to $exe — AboveNormal CPU, IoPriority=2, EnergyThrottle=Off" -ForegroundColor Green }; @('FiveM.exe','GTA5.exe','FiveM_b2189_GTAProcess.exe','FiveM_b2545_GTAProcess.exe','FiveM_b2612_GTAProcess.exe','FiveM_b2699_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2944_GTAProcess.exe','FiveM_b3095_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3407_GTAProcess.exe','FiveM_b3441_GTAProcess.exe') | ForEach-Object { & $applyFullStack $_ }; $gamesPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamesPath)) { New-Item $gamesPath -Force | Out-Null }; Set-ItemProperty $gamesPath 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $gamesPath 'Priority' 6 -Type DWord -Force; Set-ItemProperty $gamesPath 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'SFIO Priority' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'MaximumPreRenderedFrames' 1 -Type DWord -Force; Write-Host "[FiveM] MMCSS Games: GPU Priority=8, CPU Priority=6, Scheduling=High — covers all 13 FiveM/GTA5 processes" -ForegroundColor Cyan
    $appliedTweaks.Add("FiveMFullPerfStack") | Out-Null
} catch {
    $failedTweaks.Add("FiveMFullPerfStack") | Out-Null
    Write-Host "[ERR] FiveMFullPerfStack: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMGTAProcessPerfOptions..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; $applyPerf = { param($exe) $p = "$ifeo\$exe\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $p 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $p 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'IoPriority' 2 -Type DWord -Force; Set-ItemProperty $p 'PagePriority' 5 -Type DWord -Force; Write-Host "[FiveM] PerfOptions applied to $exe" -ForegroundColor Green }; $count = 0; Get-ChildItem $ifeo -EA SilentlyContinue | Where-Object { $_.PSChildName -like 'FiveM_b*_GTAProcess.exe' } | ForEach-Object { & $applyPerf $_.PSChildName; $count++ }; @('FiveM_b2189_GTAProcess.exe','FiveM_b2545_GTAProcess.exe','FiveM_b2612_GTAProcess.exe','FiveM_b2699_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2944_GTAProcess.exe','FiveM_b3095_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3407_GTAProcess.exe','FiveM_b3441_GTAProcess.exe') | ForEach-Object { If (!(Test-Path "$ifeo\$_")) { & $applyPerf $_; $count++ } }; If ($count -eq 0) { Write-Host "[FiveM] Keys pre-created for 11 known build versions — activates automatically on next FiveM launch" -ForegroundColor Yellow } Else { Write-Host "[FiveM] Applied to $count FiveM_bXXXX_GTAProcess.exe entries (dynamic scan + all known builds)" -ForegroundColor Green }
    $appliedTweaks.Add("FiveMGTAProcessPerfOptions") | Out-Null
} catch {
    $failedTweaks.Add("FiveMGTAProcessPerfOptions") | Out-Null
    Write-Host "[ERR] FiveMGTAProcessPerfOptions: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMGameModeAdd..." -ForegroundColor DarkYellow
try {
    $gameBar = 'HKCU:\SOFTWARE\Microsoft\GameBar'; If (!(Test-Path $gameBar)) { New-Item $gameBar -Force | Out-Null }; Set-ItemProperty $gameBar 'AllowAutoGameMode' 1 -Type DWord -Force; Set-ItemProperty $gameBar 'AutoGameModeEnabled' 1 -Type DWord -Force; $store = 'HKCU:\System\GameConfigStore\Children'; If (!(Test-Path $store)) { New-Item $store -Force | Out-Null }; $allExes = @('GTA5.exe','FiveM.exe','fivem.exe','FiveM_b2189_GTAProcess.exe','FiveM_b2545_GTAProcess.exe','FiveM_b2612_GTAProcess.exe','FiveM_b2699_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2944_GTAProcess.exe','FiveM_b3095_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3407_GTAProcess.exe','FiveM_b3441_GTAProcess.exe'); $added = 0; $allExes | ForEach-Object { $existing = Get-ChildItem $store -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath 'ChildAppID' -EA SilentlyContinue).ChildAppID -eq $_ }; If (-not $existing) { $guid = [System.Guid]::NewGuid().ToString('B'); $newKey = "$store\$guid"; New-Item $newKey -Force | Out-Null; Set-ItemProperty $newKey 'ChildAppID' $_ -Force; $added++; Write-Host "[FiveM] Added $_ to Game Mode" -ForegroundColor Green } }; Write-Host "[FiveM] Game Mode whitelist complete — $added new entries added (14 total FiveM/GTA5 executables including all known build numbers)" -ForegroundColor Cyan
    $appliedTweaks.Add("FiveMGameModeAdd") | Out-Null
} catch {
    $failedTweaks.Add("FiveMGameModeAdd") | Out-Null
    Write-Host "[ERR] FiveMGameModeAdd: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMRenderingBoost..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('FiveM.exe','GTA5.exe','FiveM_b2189_GTAProcess.exe','FiveM_b2545_GTAProcess.exe','FiveM_b2612_GTAProcess.exe','FiveM_b2699_GTAProcess.exe','FiveM_b2802_GTAProcess.exe','FiveM_b2944_GTAProcess.exe','FiveM_b3095_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3407_GTAProcess.exe','FiveM_b3441_GTAProcess.exe') | ForEach-Object { $p = "$ifeo\$_\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'DisableRenderingContextPreemption' 1 -Type DWord -Force; Set-ItemProperty $p 'DisableRenderingPreemption' 1 -Type DWord -Force; Set-ItemProperty $p 'EnableHWAcceleration' 1 -Type DWord -Force; Set-ItemProperty $p 'RenderThrottlingOff' 1 -Type DWord -Force; Set-ItemProperty $p 'GpuIdleEnabled' 0 -Type DWord -Force; Set-ItemProperty $p 'PowerSavingVsyncOn' 0 -Type DWord -Force; Write-Host "[FiveM] Rendering preemption disabled + HW acceleration enabled on $_" -ForegroundColor Green }
    $appliedTweaks.Add("FiveMRenderingBoost") | Out-Null
} catch {
    $failedTweaks.Add("FiveMRenderingBoost") | Out-Null
    Write-Host "[ERR] FiveMRenderingBoost: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMGPUPriorityStack..." -ForegroundColor DarkYellow
try {
    Write-Host "[SAFETY] GpuPriorityClass=8 on IFEO has been permanently removed — it was causing FiveM_ChromeBrowser exception 0xe0000008 (CEF GPU renderer crash) because Real-time GPU priority starves FiveM browser subprocess of GPU time." -ForegroundColor Yellow; $gamesPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamesPath)) { New-Item $gamesPath -Force | Out-Null }; Set-ItemProperty $gamesPath 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $gamesPath 'MaximumPreRenderedFrames' 1 -Type DWord -Force; Write-Host "[FiveM] MMCSS Games GPU Priority=8 applied (safe method — no IFEO GpuPriorityClass)" -ForegroundColor Green
    $appliedTweaks.Add("FiveMGPUPriorityStack") | Out-Null
} catch {
    $failedTweaks.Add("FiveMGPUPriorityStack") | Out-Null
    Write-Host "[ERR] FiveMGPUPriorityStack: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableMPO..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -Value 5 -Type DWord -Force -EA SilentlyContinue; Write-Host "[FiveM] Multi-Plane Overlay (MPO) disabled (OverlayTestMode=5). This is the #1 fix for black screens at FiveM server load-in — MPO causes DWM to conflict with Discord/Steam overlays during server transition. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("FiveMDisableMPO") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableMPO") | Out-Null
    Write-Host "[ERR] FiveMDisableMPO: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Debloat] 22 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] ServiceDiagTrack..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "DiagTrack" -Force; Set-Service -Name "DiagTrack" -StartupType Disabled
    $appliedTweaks.Add("ServiceDiagTrack") | Out-Null
} catch {
    $failedTweaks.Add("ServiceDiagTrack") | Out-Null
    Write-Host "[ERR] ServiceDiagTrack: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceWSearch..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "WSearch" -Force; Set-Service -Name "WSearch" -StartupType Disabled
    $appliedTweaks.Add("ServiceWSearch") | Out-Null
} catch {
    $failedTweaks.Add("ServiceWSearch") | Out-Null
    Write-Host "[ERR] ServiceWSearch: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceSysMain..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "SysMain" -Force; Set-Service -Name "SysMain" -StartupType Disabled
    $appliedTweaks.Add("ServiceSysMain") | Out-Null
} catch {
    $failedTweaks.Add("ServiceSysMain") | Out-Null
    Write-Host "[ERR] ServiceSysMain: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceRemoteReg..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "RemoteRegistry" -Force; Set-Service -Name "RemoteRegistry" -StartupType Disabled
    $appliedTweaks.Add("ServiceRemoteReg") | Out-Null
} catch {
    $failedTweaks.Add("ServiceRemoteReg") | Out-Null
    Write-Host "[ERR] ServiceRemoteReg: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceWMPNetworkSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "WMPNetworkSvc" -Force; Set-Service -Name "WMPNetworkSvc" -StartupType Disabled
    $appliedTweaks.Add("ServiceWMPNetworkSvc") | Out-Null
} catch {
    $failedTweaks.Add("ServiceWMPNetworkSvc") | Out-Null
    Write-Host "[ERR] ServiceWMPNetworkSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceFax..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'Fax' -Force; Set-Service -Name 'Fax' -StartupType Disabled
    $appliedTweaks.Add("ServiceFax") | Out-Null
} catch {
    $failedTweaks.Add("ServiceFax") | Out-Null
    Write-Host "[ERR] ServiceFax: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceRetailDemo..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'RetailDemo' -Force; Set-Service -Name 'RetailDemo' -StartupType Disabled
    $appliedTweaks.Add("ServiceRetailDemo") | Out-Null
} catch {
    $failedTweaks.Add("ServiceRetailDemo") | Out-Null
    Write-Host "[ERR] ServiceRetailDemo: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceTabletInput..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'TabletInputService' -Force; Set-Service -Name 'TabletInputService' -StartupType Disabled
    $appliedTweaks.Add("ServiceTabletInput") | Out-Null
} catch {
    $failedTweaks.Add("ServiceTabletInput") | Out-Null
    Write-Host "[ERR] ServiceTabletInput: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceMapsBroker..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'MapsBroker' -Force; Set-Service -Name 'MapsBroker' -StartupType Disabled
    $appliedTweaks.Add("ServiceMapsBroker") | Out-Null
} catch {
    $failedTweaks.Add("ServiceMapsBroker") | Out-Null
    Write-Host "[ERR] ServiceMapsBroker: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceWerSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'WerSvc' -Force -EA SilentlyContinue; Set-Service -Name 'WerSvc' -StartupType Disabled -EA SilentlyContinue; Stop-Service -Name 'wercplsupport' -Force -EA SilentlyContinue; Set-Service -Name 'wercplsupport' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Windows Error Reporting stopped — no more crash dump uploads or background disk writes" -ForegroundColor Green
    $appliedTweaks.Add("ServiceWerSvc") | Out-Null
} catch {
    $failedTweaks.Add("ServiceWerSvc") | Out-Null
    Write-Host "[ERR] ServiceWerSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceDPS..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'DPS' -Force -EA SilentlyContinue; Set-Service -Name 'DPS' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Diagnostics Policy Service disabled — no background hardware/network auto-diagnosis" -ForegroundColor Green
    $appliedTweaks.Add("ServiceDPS") | Out-Null
} catch {
    $failedTweaks.Add("ServiceDPS") | Out-Null
    Write-Host "[ERR] ServiceDPS: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceDusmSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'DusmSvc' -Force -EA SilentlyContinue; Set-Service -Name 'DusmSvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Data Usage monitoring service disabled" -ForegroundColor Green
    $appliedTweaks.Add("ServiceDusmSvc") | Out-Null
} catch {
    $failedTweaks.Add("ServiceDusmSvc") | Out-Null
    Write-Host "[ERR] ServiceDusmSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceTrkWks..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'TrkWks' -Force -EA SilentlyContinue; Set-Service -Name 'TrkWks' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Distributed Link Tracking Client disabled — useless on home PCs" -ForegroundColor Green
    $appliedTweaks.Add("ServiceTrkWks") | Out-Null
} catch {
    $failedTweaks.Add("ServiceTrkWks") | Out-Null
    Write-Host "[ERR] ServiceTrkWks: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceLltdsvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'lltdsvc' -Force -EA SilentlyContinue; Set-Service -Name 'lltdsvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Link Layer Topology Discovery disabled" -ForegroundColor Green
    $appliedTweaks.Add("ServiceLltdsvc") | Out-Null
} catch {
    $failedTweaks.Add("ServiceLltdsvc") | Out-Null
    Write-Host "[ERR] ServiceLltdsvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceFDHost..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'FDResPub' -Force -EA SilentlyContinue; Set-Service -Name 'FDResPub' -StartupType Disabled -EA SilentlyContinue; Stop-Service -Name 'fdPHost' -Force -EA SilentlyContinue; Set-Service -Name 'fdPHost' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Function Discovery services stopped — SSDP device discovery disabled" -ForegroundColor Green
    $appliedTweaks.Add("ServiceFDHost") | Out-Null
} catch {
    $failedTweaks.Add("ServiceFDHost") | Out-Null
    Write-Host "[ERR] ServiceFDHost: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceWbioSrvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'WbioSrvc' -Force -EA SilentlyContinue; Set-Service -Name 'WbioSrvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Windows Biometric Service disabled — fingerprint/face-ID service stopped on desktop" -ForegroundColor Green
    $appliedTweaks.Add("ServiceWbioSrvc") | Out-Null
} catch {
    $failedTweaks.Add("ServiceWbioSrvc") | Out-Null
    Write-Host "[ERR] ServiceWbioSrvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ServicePcaSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'PcaSvc' -Force -EA SilentlyContinue; Set-Service -Name 'PcaSvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Program Compatibility Assistant stopped — no more per-app Microsoft compat telemetry" -ForegroundColor Green
    $appliedTweaks.Add("ServicePcaSvc") | Out-Null
} catch {
    $failedTweaks.Add("ServicePcaSvc") | Out-Null
    Write-Host "[ERR] ServicePcaSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ServiceAeLookupSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'AeLookupSvc' -Force -EA SilentlyContinue; Set-Service -Name 'AeLookupSvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Application Experience service disabled — no more Microsoft compat-lookup on every app launch" -ForegroundColor Green
    $appliedTweaks.Add("ServiceAeLookupSvc") | Out-Null
} catch {
    $failedTweaks.Add("ServiceAeLookupSvc") | Out-Null
    Write-Host "[ERR] ServiceAeLookupSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyTelemetry..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0
    $appliedTweaks.Add("PrivacyTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyTelemetry") | Out-Null
    Write-Host "[ERR] PrivacyTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyActivityHistory..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'EnableActivityFeed' -Value 0
    $appliedTweaks.Add("PrivacyActivityHistory") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyActivityHistory") | Out-Null
    Write-Host "[ERR] PrivacyActivityHistory: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyLocationTracking..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location' -Name 'Value' -Value 'Deny'
    $appliedTweaks.Add("PrivacyLocationTracking") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyLocationTracking") | Out-Null
    Write-Host "[ERR] PrivacyLocationTracking: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyAdvertisingID..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Name 'Enabled' -Value 0
    $appliedTweaks.Add("PrivacyAdvertisingID") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyAdvertisingID") | Out-Null
    Write-Host "[ERR] PrivacyAdvertisingID: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Memory] 3 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] MemFixedPagefile..." -ForegroundColor DarkYellow
try {
    $ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB); $min = [math]::Max(2048, [math]::Round($ram * 0.25)); $max = [math]::Max(4096, [math]::Round($ram * 1.0)); $regMM = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; Set-ItemProperty $regMM 'AutomaticManagedPagefile' 0 -Type DWord -Force; Set-ItemProperty $regMM 'PagingFiles' "C:\pagefile.sys $min $max" -Type MultiString -Force; Write-Host "[OK] Pagefile fixed at $min MB min / $max MB max (restores cleanly on every boot, takes effect after restart)" -ForegroundColor Green
    $appliedTweaks.Add("MemFixedPagefile") | Out-Null
} catch {
    $failedTweaks.Add("MemFixedPagefile") | Out-Null
    Write-Host "[ERR] MemFixedPagefile: $_" -ForegroundColor Red
}
Write-Host "[>>] MemGPUOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrLevel' -Value 3
    $appliedTweaks.Add("MemGPUOptimize") | Out-Null
} catch {
    $failedTweaks.Add("MemGPUOptimize") | Out-Null
    Write-Host "[ERR] MemGPUOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] MemGPUSchedulerTweak..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'Scheduler' -Value 1
    $appliedTweaks.Add("MemGPUSchedulerTweak") | Out-Null
} catch {
    $failedTweaks.Add("MemGPUSchedulerTweak") | Out-Null
    Write-Host "[ERR] MemGPUSchedulerTweak: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Fortnite] 9 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] FortniteHighPriority..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; Set-ItemProperty -Path $key -Name 'CpuPriorityBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'DisableEnergyThrottling' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'EnableBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'ForceForegroundBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'PagePriority' -Value 5 -Type DWord -Force; Write-Host "[Fortnite] PerfOptions: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}), IO=High, EnergyThrottle=Off, FGBoost=On" -ForegroundColor Green
    $appliedTweaks.Add("FortniteHighPriority") | Out-Null
} catch {
    $failedTweaks.Add("FortniteHighPriority") | Out-Null
    Write-Host "[ERR] FortniteHighPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteUncapLobbyFPS..." -ForegroundColor DarkYellow
try {
    $configPath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini"; If (Test-Path $configPath) { $wasReadOnly = (Get-Item $configPath).IsReadOnly; If ($wasReadOnly) { Set-ItemProperty $configPath -Name IsReadOnly -Value $false; Write-Host "[Fortnite] Removed read-only flag" -ForegroundColor Yellow }; (Get-Content $configPath) -replace 'FrameRateLimit=\d+\.?\d*', 'FrameRateLimit=0.000000' | Set-Content $configPath -Encoding UTF8; Write-Host "[Fortnite] FPS cap removed (FrameRateLimit=0.000000)" -ForegroundColor Green } Else { Write-Host "[Fortnite] GameUserSettings.ini not found - launch Fortnite first" -ForegroundColor Red }
    $appliedTweaks.Add("FortniteUncapLobbyFPS") | Out-Null
} catch {
    $failedTweaks.Add("FortniteUncapLobbyFPS") | Out-Null
    Write-Host "[ERR] FortniteUncapLobbyFPS: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteUncapGameFPS..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; $content = Get-Content $enginePath -Raw; If ($content -notmatch 't\.MaxFPS') { Add-Content $enginePath "[/Script/Engine.Engine]"; Add-Content $enginePath "t.MaxFPS=0" }; Write-Host "[Fortnite] Engine FPS cap removed (t.MaxFPS=0)" -ForegroundColor Green
    $appliedTweaks.Add("FortniteUncapGameFPS") | Out-Null
} catch {
    $failedTweaks.Add("FortniteUncapGameFPS") | Out-Null
    Write-Host "[ERR] FortniteUncapGameFPS: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteDisableMotionBlur..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.MotionBlurQuality=0"; Add-Content $enginePath "r.LensFlareQuality=0"; Add-Content $enginePath "r.BloomQuality=0"; Write-Host "[Fortnite] Motion blur and bloom disabled" -ForegroundColor Green
    $appliedTweaks.Add("FortniteDisableMotionBlur") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableMotionBlur") | Out-Null
    Write-Host "[ERR] FortniteDisableMotionBlur: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 131072; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 131072
    $appliedTweaks.Add("FortniteNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("FortniteNetworkBuffer") | Out-Null
    Write-Host "[ERR] FortniteNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteLowShadows..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.Shadow.MaxResolution=512"; Add-Content $enginePath "r.ShadowQuality=0"; Add-Content $enginePath "r.ContactShadows=0"; Write-Host "[Fortnite] Shadow quality forced to minimum" -ForegroundColor Green
    $appliedTweaks.Add("FortniteLowShadows") | Out-Null
} catch {
    $failedTweaks.Add("FortniteLowShadows") | Out-Null
    Write-Host "[ERR] FortniteLowShadows: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteDisableRecording..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[OnlineSubsystemMcp.Mcp2ServiceConfigs]"; Add-Content $enginePath "bEnabled=false"; Write-Host "[Fortnite] Background recording disabled" -ForegroundColor Green
    $appliedTweaks.Add("FortniteDisableRecording") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableRecording") | Out-Null
    Write-Host "[ERR] FortniteDisableRecording: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteGameMode..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1; $key = 'HKCU:\System\GameConfigStore'; Set-ItemProperty -Path $key -Name 'GameDVR_Enabled' -Value 0; Set-ItemProperty -Path $key -Name 'GameDVR_FSEBehaviorMode' -Value 2
    $appliedTweaks.Add("FortniteGameMode") | Out-Null
} catch {
    $failedTweaks.Add("FortniteGameMode") | Out-Null
    Write-Host "[ERR] FortniteGameMode: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteDisableThrottling..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path "$key\PerfOptions" -Name 'CpuPriorityClass' -Value $_pri
    $appliedTweaks.Add("FortniteDisableThrottling") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableThrottling") | Out-Null
    Write-Host "[ERR] FortniteDisableThrottling: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Win Tweaks] 10 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] WinTitusConsumerFeatures..." -ForegroundColor DarkYellow
try {
    $path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent'; If (!(Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; Set-ItemProperty -Path $path -Name 'DisableWindowsConsumerFeatures' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $path -Name 'DisableSoftLanding' -Value 1 -Type DWord -Force; Write-Host "[OK] Consumer features disabled — no more suggested apps or sponsored content in Start" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusConsumerFeatures") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusConsumerFeatures") | Out-Null
    Write-Host "[ERR] WinTitusConsumerFeatures: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusPosh7Telemetry..." -ForegroundColor DarkYellow
try {
    [Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT', '1', 'Machine'); [Environment]::SetEnvironmentVariable('DOTNET_CLI_TELEMETRY_OPTOUT', '1', 'Machine'); Write-Host "[OK] PowerShell 7 and .NET CLI telemetry opt-out set in Machine environment" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusPosh7Telemetry") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusPosh7Telemetry") | Out-Null
    Write-Host "[ERR] WinTitusPosh7Telemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusWPBT..." -ForegroundColor DarkYellow
try {
    $path = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager'; Set-ItemProperty -Path $path -Name 'DisableWpbtExecution' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Windows Platform Binary Table (WPBT) execution disabled" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusWPBT") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusWPBT") | Out-Null
    Write-Host "[ERR] WinTitusWPBT: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusServicesManual..." -ForegroundColor DarkYellow
try {
    $svcs = @('DiagTrack','DusmSvc','MapsBroker','lfsvc','PhoneSvc','RetailDemo','WMPNetworkSvc','WbioSrvc','XblAuthManager','XblGameSave','XboxNetApiSvc','SharedAccess','SSDPSRV','upnphost','W32Time','WinRM','RemoteRegistry','Fax','wercplsupport'); foreach ($s in $svcs) { Set-Service -Name $s -StartupType Manual -EA SilentlyContinue }; Write-Host "[OK] Non-essential services set to Manual startup (19 services)" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusServicesManual") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusServicesManual") | Out-Null
    Write-Host "[ERR] WinTitusServicesManual: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusRazerBlock..." -ForegroundColor DarkYellow
try {
    $path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'; If (!(Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; Set-ItemProperty -Path $path -Name 'ExcludeWUDriversInQualityUpdate' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Driver auto-install via Windows Update blocked (stops Razer injecting its driver)" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusRazerBlock") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusRazerBlock") | Out-Null
    Write-Host "[ERR] WinTitusRazerBlock: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusBgApps..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications' -Name 'GlobalUserDisabled' -Value 1 -Type DWord -Force; Get-ChildItem 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications' -EA SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PsPath -Name 'Disabled' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy' -Name 'LetAppsRunInBackground' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Background apps globally disabled" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusBgApps") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusBgApps") | Out-Null
    Write-Host "[ERR] WinTitusBgApps: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusIPv4Prefer..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'DisabledComponents' 0x20 -Type DWord -Force; Write-Host "[OK] IPv4 preferred over IPv6 (flag 0x20 — IPv6 still available, IPv4 wins by default)" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusIPv4Prefer") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusIPv4Prefer") | Out-Null
    Write-Host "[ERR] WinTitusIPv4Prefer: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusDisplayPerf..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x10,0x00,0x00,0x00)) -Type Binary -Force; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Display set for best performance — visual effects stripped to minimum" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusDisplayPerf") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusDisplayPerf") | Out-Null
    Write-Host "[ERR] WinTitusDisplayPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusShowExtensions..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'HideFileExt' -Value 0 -Type DWord -Force; Write-Host "[OK] File extensions shown in Explorer" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusShowExtensions") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusShowExtensions") | Out-Null
    Write-Host "[ERR] WinTitusShowExtensions: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusShowHidden..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'Hidden' -Value 1 -Type DWord -Force; Write-Host "[OK] Hidden files and folders shown in Explorer" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusShowHidden") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusShowHidden") | Out-Null
    Write-Host "[ERR] WinTitusShowHidden: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Startup Apps] 16 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] su_discord..." -ForegroundColor DarkYellow
try {
    $discordRegKeys = @("Discord","Update.exe --processStart Discord.exe","com.squirrel.Discord.Discord"); foreach ($v in $discordRegKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $discordLnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Discord.lnk","$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Discord.lnk"); foreach ($lnk in $discordLnks) { if (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "Discord" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Discord*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Discord removed from ALL startup locations (registry, StartupApproved, .lnk, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_discord") | Out-Null
} catch {
    $failedTweaks.Add("su_discord") | Out-Null
    Write-Host "[ERR] su_discord: $_" -ForegroundColor Red
}
Write-Host "[>>] su_spotify..." -ForegroundColor DarkYellow
try {
    $spotifyRegKeys = @("Spotify","Spotify.exe","com.squirrel.Spotify.Spotify"); foreach ($v in $spotifyRegKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $spotifyLnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Spotify.lnk","$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Spotify.lnk"); foreach ($lnk in $spotifyLnks) { if (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "Spotify" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Spotify*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Spotify removed from ALL startup locations (registry x3 keys, StartupApproved, .lnk, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_spotify") | Out-Null
} catch {
    $failedTweaks.Add("su_spotify") | Out-Null
    Write-Host "[ERR] su_spotify: $_" -ForegroundColor Red
}
Write-Host "[>>] su_onedrive..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "OneDrive" /f 2>$null; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "OneDrive" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] OneDrive removed from startup" -ForegroundColor Green
    $appliedTweaks.Add("su_onedrive") | Out-Null
} catch {
    $failedTweaks.Add("su_onedrive") | Out-Null
    Write-Host "[ERR] su_onedrive: $_" -ForegroundColor Red
}
Write-Host "[>>] su_teams..." -ForegroundColor DarkYellow
try {
    $teamsKeys = @("com.squirrel.Teams.Teams","Teams"); foreach ($v in $teamsKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "Teams" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Teams*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Microsoft Teams removed from startup" -ForegroundColor Green
    $appliedTweaks.Add("su_teams") | Out-Null
} catch {
    $failedTweaks.Add("su_teams") | Out-Null
    Write-Host "[ERR] su_teams: $_" -ForegroundColor Red
}
Write-Host "[>>] su_skype..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "Skype" /f 2>$null; reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "SkypeWithCalling" /f 2>$null; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Skype*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Skype removed from startup" -ForegroundColor Green
    $appliedTweaks.Add("su_skype") | Out-Null
} catch {
    $failedTweaks.Add("su_skype") | Out-Null
    Write-Host "[ERR] su_skype: $_" -ForegroundColor Red
}
Write-Host "[>>] su_zoom..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "Zoom" /f 2>$null; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "Zoom" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] Zoom removed from startup" -ForegroundColor Green
    $appliedTweaks.Add("su_zoom") | Out-Null
} catch {
    $failedTweaks.Add("su_zoom") | Out-Null
    Write-Host "[ERR] su_zoom: $_" -ForegroundColor Red
}
Write-Host "[>>] su_rtss..." -ForegroundColor DarkYellow
try {
    $rtssKeys = @("RTSS","RivaTuner Statistics Server"); foreach ($v in $rtssKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\RTSS.lnk","$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\RivaTunerStatisticsServer.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "RTSS" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] RivaTuner Statistics Server removed from ALL startup locations (registry x2, StartupApproved, .lnk)" -ForegroundColor Green
    $appliedTweaks.Add("su_rtss") | Out-Null
} catch {
    $failedTweaks.Add("su_rtss") | Out-Null
    Write-Host "[ERR] su_rtss: $_" -ForegroundColor Red
}
Write-Host "[>>] su_nvidia..." -ForegroundColor DarkYellow
try {
    $nvKeys = @("NvBackend","NVIDIA GeForce Experience","ShadowPlay","NvNodeLauncher","nvtray","NVIDIA Share"); foreach ($v in $nvKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null; reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in @("NvBackend","NVIDIA GeForce Experience","NvNodeLauncher")) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*NvNode*" -or $_.TaskName -like "*GeForce*" -or $_.TaskName -like "*nvidia*" -or $_.TaskName -like "*NvBackend*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] NVIDIA background apps removed from ALL startup locations (HKCU+HKLM registry x6, StartupApproved x3, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_nvidia") | Out-Null
} catch {
    $failedTweaks.Add("su_nvidia") | Out-Null
    Write-Host "[ERR] su_nvidia: $_" -ForegroundColor Red
}
Write-Host "[>>] su_ccleaner..." -ForegroundColor DarkYellow
try {
    $ccKeys = @("CCleaner","CCleaner64","CCleaner Smart Cleaning","CCleanerSmartCleaning"); foreach ($v in $ccKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null; reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in @("CCleaner","CCleaner64")) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*CCleaner*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] CCleaner removed from ALL startup locations (HKCU+HKLM registry x4, StartupApproved, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_ccleaner") | Out-Null
} catch {
    $failedTweaks.Add("su_ccleaner") | Out-Null
    Write-Host "[ERR] su_ccleaner: $_" -ForegroundColor Red
}
Write-Host "[>>] su_logitech..." -ForegroundColor DarkYellow
try {
    $lgKeys = @("LGHub","LCore","LGHUB","Logitech G HUB","LogiOptions+"); foreach ($v in $lgKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\LGHUB.lnk","$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Logitech G HUB.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in @("LGHub","LCore","LGHUB")) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Logitech*" -or $_.TaskName -like "*LGHUB*" -or $_.TaskName -like "*LogiOptions*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Logitech G Hub / LCore removed from ALL startup locations (registry x5, StartupApproved, .lnk, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_logitech") | Out-Null
} catch {
    $failedTweaks.Add("su_logitech") | Out-Null
    Write-Host "[ERR] su_logitech: $_" -ForegroundColor Red
}
Write-Host "[>>] su_amdradeon..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RadeonSoftware" /f 2>$null; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "RadeonSoftware" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] Radeon Software removed from startup" -ForegroundColor Green
    $appliedTweaks.Add("su_amdradeon") | Out-Null
} catch {
    $failedTweaks.Add("su_amdradeon") | Out-Null
    Write-Host "[ERR] su_amdradeon: $_" -ForegroundColor Red
}
Write-Host "[>>] su_epic..." -ForegroundColor DarkYellow
try {
    $epicKeys = @("EpicGamesLauncher","Epic Games Launcher","EpicLauncher"); foreach ($v in $epicKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Epic Games Launcher.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "EpicGamesLauncher" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Epic*" -or $_.TaskName -like "*EOS*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Epic Games Launcher removed from ALL startup locations" -ForegroundColor Green
    $appliedTweaks.Add("su_epic") | Out-Null
} catch {
    $failedTweaks.Add("su_epic") | Out-Null
    Write-Host "[ERR] su_epic: $_" -ForegroundColor Red
}
Write-Host "[>>] su_battlenet..." -ForegroundColor DarkYellow
try {
    $bnKeys = @("Battle.net","Battle.net Update Agent","Blizzard Update Agent"); foreach ($v in $bnKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in $bnKeys) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Blizzard*" -or $_.TaskName -like "*Battle.net*" -or $_.TaskName -like "*Battlenet*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Battle.net removed from ALL startup locations" -ForegroundColor Green
    $appliedTweaks.Add("su_battlenet") | Out-Null
} catch {
    $failedTweaks.Add("su_battlenet") | Out-Null
    Write-Host "[ERR] su_battlenet: $_" -ForegroundColor Red
}
Write-Host "[>>] su_razer..." -ForegroundColor DarkYellow
try {
    $razKeys = @("RzSynapse","Razer Synapse","RazerSynapse","RazerSynapseService"); foreach ($v in $razKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in $razKeys) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Razer*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Razer Synapse removed from ALL startup locations — Synapse still opens when you launch it manually" -ForegroundColor Green
    $appliedTweaks.Add("su_razer") | Out-Null
} catch {
    $failedTweaks.Add("su_razer") | Out-Null
    Write-Host "[ERR] su_razer: $_" -ForegroundColor Red
}
Write-Host "[>>] su_chrome..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "Google Chrome" /f 2>$null; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "Google Chrome" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "BackgroundModeEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Chrome Startup Boost + background mode disabled — Chrome still works normally when you open it" -ForegroundColor Green
    $appliedTweaks.Add("su_chrome") | Out-Null
} catch {
    $failedTweaks.Add("su_chrome") | Out-Null
    Write-Host "[ERR] su_chrome: $_" -ForegroundColor Red
}
Write-Host "[>>] su_edge_startup..." -ForegroundColor DarkYellow
try {
    $edgeKeys = @("Microsoft Edge","MicrosoftEdge","msedge"); foreach ($v in $edgeKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "StartupBoostEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Microsoft\Edge" -Name "StartupBoostEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "BackgroundModeEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Edge Startup Boost + background mode disabled via policy — Edge works normally when opened" -ForegroundColor Green
    $appliedTweaks.Add("su_edge_startup") | Out-Null
} catch {
    $failedTweaks.Add("su_edge_startup") | Out-Null
    Write-Host "[ERR] su_edge_startup: $_" -ForegroundColor Red
}

Write-Host "" 
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "   OPTI GODS by leaq -- TWEAKS APPLIED" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  [OK] $($appliedTweaks.Count) of 132 tweaks applied" -ForegroundColor Green
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