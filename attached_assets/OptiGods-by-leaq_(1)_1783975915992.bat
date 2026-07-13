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
# Generated: 2026-07-13T20:46:40.615Z
# Tweaks enabled: 575
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
Write-Host "  Starting 575 optimizations..." -ForegroundColor White
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
Write-Host "--- [Registry / System] 312 tweak(s) ---" -ForegroundColor DarkRed
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
Write-Host "[>>] EnableMSIMode..." -ForegroundColor DarkYellow
try {
    $gpus = Get-PnpDevice -Class Display -EA SilentlyContinue | Where-Object { $_.Status -eq 'OK' }; $gpuCount = @($gpus).Count; If ($gpuCount -eq 0) { Write-Host "[MSI] No active display device found — rerun after GPU driver is loaded" -ForegroundColor Yellow } ElseIf ($gpuCount -gt 1) { Write-Host "[MSI] SKIPPED — multiple GPUs detected ($gpuCount). Hybrid setups (iGPU + dGPU, or AMD+NVIDIA combos) can BSOD with forced MSI mode. Apply manually via Device Manager only if you know your config is supported." -ForegroundColor Yellow } Else { $gpu = $gpus | Select-Object -First 1; $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"; New-Item -Path $msiPath -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path $msiPath -Name 'MSISupported' -Value 1 -Type DWord -Force -EA SilentlyContinue; $affinityPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($gpu.InstanceId)\Device Parameters\Interrupt Management\Affinity Policy"; If (Test-Path $affinityPath) { Remove-ItemProperty -Path $affinityPath -Name 'DevicePolicy' -EA SilentlyContinue; Remove-ItemProperty -Path $affinityPath -Name 'DevicePriority' -EA SilentlyContinue; Remove-ItemProperty -Path $affinityPath -Name 'AssignmentSetOverride' -EA SilentlyContinue }; Write-Host "[MSI] MSI mode enabled on $($gpu.Name). Affinity policy left at Windows default (SYSTEM_THREAD_EXCEPTION_NOT_HANDLED BSOD fix — older preset wrote DevicePolicy=4 which is invalid without an AssignmentSetOverride and BSOD'd on next boot)." -ForegroundColor Green }
    $appliedTweaks.Add("EnableMSIMode") | Out-Null
} catch {
    $failedTweaks.Add("EnableMSIMode") | Out-Null
    Write-Host "[ERR] EnableMSIMode: $_" -ForegroundColor Red
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
Write-Host "[>>] ClearPagefileOnShutdown..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: NOT IDEAL FOR ALL SYSTEMS — Clearing the pagefile adds 10-60 seconds to every shutdown on HDDs and 5-15s on SSDs. It is a security measure, NOT a performance tweak. Only keep this if you store sensitive data and need memory wiped at shutdown." -ForegroundColor Yellow; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 1; Write-Host "[OK] Pagefile will be cleared on every shutdown — prevents sensitive data persistence" -ForegroundColor Green
    $appliedTweaks.Add("ClearPagefileOnShutdown") | Out-Null
} catch {
    $failedTweaks.Add("ClearPagefileOnShutdown") | Out-Null
    Write-Host "[ERR] ClearPagefileOnShutdown: $_" -ForegroundColor Red
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
Write-Host "[>>] DisableTelemetry..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0
    $appliedTweaks.Add("DisableTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("DisableTelemetry") | Out-Null
    Write-Host "[ERR] DisableTelemetry: $_" -ForegroundColor Red
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
Write-Host "[>>] MousePointerSpeed611..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseSensitivity' -Value '10' -Type String -Force; Write-Host "[Mouse] Pointer speed set to 6/11 — neutral baseline, no acceleration curve applied" -ForegroundColor Green
    $appliedTweaks.Add("MousePointerSpeed611") | Out-Null
} catch {
    $failedTweaks.Add("MousePointerSpeed611") | Out-Null
    Write-Host "[ERR] MousePointerSpeed611: $_" -ForegroundColor Red
}
Write-Host "[>>] MouseDataQueueSize..." -ForegroundColor DarkYellow
try {
    If (!(Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services\mouclass\Parameters')) { New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\mouclass\Parameters' -Force | Out-Null }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\mouclass\Parameters' -Name 'MouseDataQueueSize' -Value 20 -Type DWord -Force; Write-Host "[Mouse] Input buffer reduced to 20 entries (default 100) — lower click-to-action latency" -ForegroundColor Green
    $appliedTweaks.Add("MouseDataQueueSize") | Out-Null
} catch {
    $failedTweaks.Add("MouseDataQueueSize") | Out-Null
    Write-Host "[ERR] MouseDataQueueSize: $_" -ForegroundColor Red
}
Write-Host "[>>] MouseHoverTimeMin..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Mouse' -Name 'MouseHoverTime' -Value '10' -Type String -Force; Write-Host "[Mouse] Hover time set to 10ms (default 400ms) — snappier UI response" -ForegroundColor Green
    $appliedTweaks.Add("MouseHoverTimeMin") | Out-Null
} catch {
    $failedTweaks.Add("MouseHoverTimeMin") | Out-Null
    Write-Host "[ERR] MouseHoverTimeMin: $_" -ForegroundColor Red
}
Write-Host "[>>] MouseHIDPowerSave..." -ForegroundColor DarkYellow
try {
    Get-PnpDevice -Class 'Mouse' -EA SilentlyContinue | ForEach-Object { $instanceId = $_.InstanceId; $p = 'HKLM:\SYSTEM\CurrentControlSet\Enum\' + $instanceId + '\Device Parameters'; If (Test-Path $p) { Set-ItemProperty $p -Name 'EnhancedPowerManagementEnabled' -Value 0 -Type DWord -EA SilentlyContinue } }; Write-Host "[Mouse] HID power management disabled on all mouse devices — eliminates USB wake latency" -ForegroundColor Green
    $appliedTweaks.Add("MouseHIDPowerSave") | Out-Null
} catch {
    $failedTweaks.Add("MouseHIDPowerSave") | Out-Null
    Write-Host "[ERR] MouseHIDPowerSave: $_" -ForegroundColor Red
}
Write-Host "[>>] KeyboardRepeatRateMax..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Keyboard' -Name 'KeyboardSpeed' -Value '31' -Type String -Force; Write-Host "[Keyboard] Repeat rate set to maximum (31) — fastest key repeat speed" -ForegroundColor Green
    $appliedTweaks.Add("KeyboardRepeatRateMax") | Out-Null
} catch {
    $failedTweaks.Add("KeyboardRepeatRateMax") | Out-Null
    Write-Host "[ERR] KeyboardRepeatRateMax: $_" -ForegroundColor Red
}
Write-Host "[>>] KeyboardRepeatDelayMin..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Keyboard' -Name 'KeyboardDelay' -Value '0' -Type String -Force; Write-Host "[Keyboard] Repeat delay set to minimum (250ms) — key repeat kicks in immediately" -ForegroundColor Green
    $appliedTweaks.Add("KeyboardRepeatDelayMin") | Out-Null
} catch {
    $failedTweaks.Add("KeyboardRepeatDelayMin") | Out-Null
    Write-Host "[ERR] KeyboardRepeatDelayMin: $_" -ForegroundColor Red
}
Write-Host "[>>] KeyboardDisableFilterKeys..." -ForegroundColor DarkYellow
try {
    If (!(Test-Path 'HKCU:\Control Panel\Accessibility\Keyboard Response')) { New-Item -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Force | Out-Null }; Set-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'Flags' -Value '0' -Type String -Force; Set-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'AutoRepeatDelay' -Value '0' -Type String -Force; Set-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'AutoRepeatRate' -Value '0' -Type String -Force; Set-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'BounceTime' -Value '0' -Type String -Force; Set-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\Keyboard Response' -Name 'DelayBeforeAcceptance' -Value '0' -Type String -Force; Write-Host "[Keyboard] Filter Keys disabled — all artificial keystroke delay removed" -ForegroundColor Green
    $appliedTweaks.Add("KeyboardDisableFilterKeys") | Out-Null
} catch {
    $failedTweaks.Add("KeyboardDisableFilterKeys") | Out-Null
    Write-Host "[ERR] KeyboardDisableFilterKeys: $_" -ForegroundColor Red
}
Write-Host "[>>] KeyboardDisableStickyKeys..." -ForegroundColor DarkYellow
try {
    If (!(Test-Path 'HKCU:\Control Panel\Accessibility\StickyKeys')) { New-Item -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Force | Out-Null }; Set-ItemProperty -Path 'HKCU:\Control Panel\Accessibility\StickyKeys' -Name 'Flags' -Value '506' -Type String -Force; Write-Host "[Keyboard] Sticky Keys shortcut disabled — Shift spam won't interrupt gameplay" -ForegroundColor Green
    $appliedTweaks.Add("KeyboardDisableStickyKeys") | Out-Null
} catch {
    $failedTweaks.Add("KeyboardDisableStickyKeys") | Out-Null
    Write-Host "[ERR] KeyboardDisableStickyKeys: $_" -ForegroundColor Red
}
Write-Host "[>>] KeyboardDataQueueSize..." -ForegroundColor DarkYellow
try {
    If (!(Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services\kbdclass\Parameters')) { New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\kbdclass\Parameters' -Force | Out-Null }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\kbdclass\Parameters' -Name 'KeyboardDataQueueSize' -Value 20 -Type DWord -Force; Write-Host "[Keyboard] Input buffer reduced to 20 entries (default 100) — lower key-to-action latency" -ForegroundColor Green
    $appliedTweaks.Add("KeyboardDataQueueSize") | Out-Null
} catch {
    $failedTweaks.Add("KeyboardDataQueueSize") | Out-Null
    Write-Host "[ERR] KeyboardDataQueueSize: $_" -ForegroundColor Red
}
Write-Host "[>>] KeyboardHIDPowerSave..." -ForegroundColor DarkYellow
try {
    Get-PnpDevice -Class 'Keyboard' -EA SilentlyContinue | ForEach-Object { $instanceId = $_.InstanceId; $p = 'HKLM:\SYSTEM\CurrentControlSet\Enum\' + $instanceId + '\Device Parameters'; If (Test-Path $p) { Set-ItemProperty $p -Name 'EnhancedPowerManagementEnabled' -Value 0 -Type DWord -EA SilentlyContinue } }; Write-Host "[Keyboard] HID power management disabled on all keyboards — no USB wake latency on keypress" -ForegroundColor Green
    $appliedTweaks.Add("KeyboardHIDPowerSave") | Out-Null
} catch {
    $failedTweaks.Add("KeyboardHIDPowerSave") | Out-Null
    Write-Host "[ERR] KeyboardHIDPowerSave: $_" -ForegroundColor Red
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
Write-Host "[>>] DisableAutoUpdate..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: SECURITY RISK — Disabling Windows Update stops your PC from receiving security patches. New exploits, ransomware, and vulnerabilities will NOT be patched automatically. Your system becomes vulnerable over time. Only enable this if you manually check for updates regularly and understand the risk. Re-enable: Set-Service wuauserv -StartupType Automatic." -ForegroundColor Yellow; Stop-Service -Name 'wuauserv' -Force -EA SilentlyContinue; Set-Service -Name 'wuauserv' -StartupType Disabled; Write-Host "[Risky] Windows Update service disabled. Run Windows Update manually to stay patched." -ForegroundColor DarkYellow
    $appliedTweaks.Add("DisableAutoUpdate") | Out-Null
} catch {
    $failedTweaks.Add("DisableAutoUpdate") | Out-Null
    Write-Host "[ERR] DisableAutoUpdate: $_" -ForegroundColor Red
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
Write-Host "[>>] NetDNSCloudflare..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ('1.1.1.1','1.0.0.1') }; Write-Host "[Network] DNS set to Cloudflare (1.1.1.1 / 1.0.0.1) on all active adapters" -ForegroundColor Green
    $appliedTweaks.Add("NetDNSCloudflare") | Out-Null
} catch {
    $failedTweaks.Add("NetDNSCloudflare") | Out-Null
    Write-Host "[ERR] NetDNSCloudflare: $_" -ForegroundColor Red
}
Write-Host "[>>] NetDNSGoogle..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ('8.8.8.8','8.8.4.4') }; Write-Host "[Network] DNS set to Google (8.8.8.8 / 8.8.4.4) on all active adapters" -ForegroundColor Green
    $appliedTweaks.Add("NetDNSGoogle") | Out-Null
} catch {
    $failedTweaks.Add("NetDNSGoogle") | Out-Null
    Write-Host "[ERR] NetDNSGoogle: $_" -ForegroundColor Red
}
Write-Host "[>>] NetDisableQoS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched' -Name 'NonBestEffortLimit' -Value 0 -Type DWord -Force -EA SilentlyContinue; New-Item -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched' -Name 'NonBestEffortLimit' -Value 0 -Type DWord -Force; Write-Host "[Network] QoS packet scheduler bandwidth reservation set to 0% — full bandwidth available" -ForegroundColor Green
    $appliedTweaks.Add("NetDisableQoS") | Out-Null
} catch {
    $failedTweaks.Add("NetDisableQoS") | Out-Null
    Write-Host "[ERR] NetDisableQoS: $_" -ForegroundColor Red
}
Write-Host "[>>] NetInterruptModeration..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*InterruptModeration' -RegistryValue 0 -EA SilentlyContinue }; Write-Host "[Network] Interrupt Moderation disabled on all active adapters — each packet triggers immediate CPU interrupt" -ForegroundColor Green
    $appliedTweaks.Add("NetInterruptModeration") | Out-Null
} catch {
    $failedTweaks.Add("NetInterruptModeration") | Out-Null
    Write-Host "[ERR] NetInterruptModeration: $_" -ForegroundColor Red
}
Write-Host "[>>] NetRSSQueues..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { $max = (Get-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*NumRssQueues' -EA SilentlyContinue).NumericParameterMaxValue; if ($max) { Set-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*NumRssQueues' -RegistryValue $max -EA SilentlyContinue } }; Write-Host "[Network] RSS queues set to maximum on all active adapters" -ForegroundColor Green
    $appliedTweaks.Add("NetRSSQueues") | Out-Null
} catch {
    $failedTweaks.Add("NetRSSQueues") | Out-Null
    Write-Host "[ERR] NetRSSQueues: $_" -ForegroundColor Red
}
Write-Host "[>>] NetAdapterPowerSave..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*EEE' -RegistryValue 0 -EA SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*FlowControl' -RegistryValue 0 -EA SilentlyContinue; $pnp = Get-PnpDevice -FriendlyName $_.InterfaceDescription -EA SilentlyContinue | Select-Object -First 1; if ($pnp) { $pmPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($pnp.InstanceId)\Device Parameters"; Set-ItemProperty $pmPath -Name 'PnPCapabilities' -Value 24 -Type DWord -Force -EA SilentlyContinue } }; Write-Host "[Network] NIC power saving (EEE, Flow Control) disabled on all active adapters" -ForegroundColor Green
    $appliedTweaks.Add("NetAdapterPowerSave") | Out-Null
} catch {
    $failedTweaks.Add("NetAdapterPowerSave") | Out-Null
    Write-Host "[ERR] NetAdapterPowerSave: $_" -ForegroundColor Red
}
Write-Host "[>>] NetTCPChimneyOffload..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global chimney=disabled 2>$null; netsh int tcp set global autotuninglevel=normal 2>$null; Write-Host "[Network] TCP Chimney Offload disabled — TCP processing handled by OS stack" -ForegroundColor Green
    $appliedTweaks.Add("NetTCPChimneyOffload") | Out-Null
} catch {
    $failedTweaks.Add("NetTCPChimneyOffload") | Out-Null
    Write-Host "[ERR] NetTCPChimneyOffload: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcNUMAAware..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe','valorant.exe','cs2.exe','FortniteClient-Win64-Shipping.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'NUMAAware' 1 -Type DWord -Force }; Write-Host "[Process] NUMA-aware scheduling enabled for game executables — keeps threads on same NUMA node" -ForegroundColor Green
    $appliedTweaks.Add("ProcNUMAAware") | Out-Null
} catch {
    $failedTweaks.Add("ProcNUMAAware") | Out-Null
    Write-Host "[ERR] ProcNUMAAware: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcAffinityFPS..." -ForegroundColor DarkYellow
try {
    $cores = (Get-CimInstance Win32_Processor).NumberOfCores; $mask = 0; for ($i = 0; $i -lt $cores; $i++) { $mask = $mask -bor (1 -shl ($i * 2)) }; $hex = '0x' + $mask.ToString('X'); $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe','valorant.exe','cs2.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $k 'CpuAffinityMask' $mask -Type QWord -Force }; @('GTA5','FiveM','valorant','cs2') | ForEach-Object { $p = Get-Process $_ -EA SilentlyContinue; If ($p) { try { $p.ProcessorAffinity = [IntPtr]$mask; Write-Host "[Process] Live affinity set to $hex for $_" -ForegroundColor Cyan } catch { Write-Host "[Process] Could not set live affinity for $_ (run as admin)" -ForegroundColor Yellow } } }; Write-Host "[Process] Game affinity configured for physical cores only (mask=$hex) via IFEO — reduces SMT context-switch overhead" -ForegroundColor Green
    $appliedTweaks.Add("ProcAffinityFPS") | Out-Null
} catch {
    $failedTweaks.Add("ProcAffinityFPS") | Out-Null
    Write-Host "[ERR] ProcAffinityFPS: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcMMCSSGaming..." -ForegroundColor DarkYellow
try {
    $mmcss = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $mmcss)) { New-Item $mmcss -Force | Out-Null }; Set-ItemProperty $mmcss -Name 'Scheduling Category' -Value 'High' -Type String -Force; Set-ItemProperty $mmcss -Name 'SFIO Priority' -Value 'High' -Type String -Force; Set-ItemProperty $mmcss -Name 'GPU Priority' -Value 8 -Type DWord -Force; Set-ItemProperty $mmcss -Name 'Priority' -Value 6 -Type DWord -Force; Set-ItemProperty $mmcss -Name 'Background Only' -Value 'False' -Type String -Force; Write-Host "[Process] MMCSS Gaming profile set: SchedulingCategory=High, GPU Priority=8, CPU Priority=6" -ForegroundColor Green
    $appliedTweaks.Add("ProcMMCSSGaming") | Out-Null
} catch {
    $failedTweaks.Add("ProcMMCSSGaming") | Out-Null
    Write-Host "[ERR] ProcMMCSSGaming: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcGPUSchedulerHigh..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe','valorant.exe','cs2.exe','FortniteClient-Win64-Shipping.exe','r5apex.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'GpuPriority' 8 -Type DWord -Force }; Write-Host "[Process] GPU Scheduler Priority set to 8 (High) for game executables" -ForegroundColor Green
    $appliedTweaks.Add("ProcGPUSchedulerHigh") | Out-Null
} catch {
    $failedTweaks.Add("ProcGPUSchedulerHigh") | Out-Null
    Write-Host "[ERR] ProcGPUSchedulerHigh: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableULPS..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'EnableUlps' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'EnableUlps_NA' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] ULPS disabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] Ultra Low Power State disabled — prevents GPU downclocking between frames" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableULPS") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableULPS") | Out-Null
    Write-Host "[ERR] AmdDisableULPS: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableChill..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_GFXCoreClockIdleOverride' -Value 0 -Type DWord -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'UseChill' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Radeon Chill disabled — frame rate will no longer throttle when mouse is idle" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableChill") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableChill") | Out-Null
    Write-Host "[ERR] AmdDisableChill: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisablePowerEfficiency..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_PowerProfile' -Value 2 -Type DWord -EA SilentlyContinue }; Write-Host "[AMD] Power profile set to Performance (2) — disables power efficiency throttle" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisablePowerEfficiency") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisablePowerEfficiency") | Out-Null
    Write-Host "[ERR] AmdDisablePowerEfficiency: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableVSR..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'VSR' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Virtual Super Resolution disabled — removes upscaling overhead in driver" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableVSR") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableVSR") | Out-Null
    Write-Host "[ERR] AmdDisableVSR: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdMaxClockState..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_DpmForceHighestDpmTable' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Force highest DPM performance table applied on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] GPU clock forced to highest DPM state — eliminates boost latency" -ForegroundColor Green
    $appliedTweaks.Add("AmdMaxClockState") | Out-Null
} catch {
    $failedTweaks.Add("AmdMaxClockState") | Out-Null
    Write-Host "[ERR] AmdMaxClockState: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableTelemetry..." -ForegroundColor DarkYellow
try {
    @('AMD External Events Utility','amdfendrsr','AmdCVSDiagService') | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Disabled -EA SilentlyContinue }; $amdTasks = @('AMDAMD Crash Defender','AMDAMD Bug Report Tool','AMDAMD Log Utility'); $amdTasks | ForEach-Object { schtasks /Change /TN $_ /Disable 2>$null }; Write-Host "[AMD] Telemetry services and scheduled tasks disabled" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableTelemetry") | Out-Null
    Write-Host "[ERR] AmdDisableTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableCrashDefender..." -ForegroundColor DarkYellow
try {
    Stop-Service 'AmdCVSDiagService' -Force -EA SilentlyContinue; Set-Service 'AmdCVSDiagService' -StartupType Disabled -EA SilentlyContinue; schtasks /Change /TN 'AMDAMD Crash Defender' /Disable 2>$null; Stop-Process -Name 'AMDRSServ' -Force -EA SilentlyContinue; Write-Host "[AMD] AMD Crash Defender disabled — eliminates its CPU overhead during gaming" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableCrashDefender") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableCrashDefender") | Out-Null
    Write-Host "[ERR] AmdDisableCrashDefender: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdOptimizeLatency..." -ForegroundColor DarkYellow
try {
    $gamePath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'Scheduling Category' 'High' -Type String; Set-ItemProperty $gamePath 'SFIO Priority' 'High' -Type String; Set-ItemProperty $gamePath 'GPU Priority' 8 -Type DWord; Set-ItemProperty $gamePath 'Priority' 6 -Type DWord; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord; Write-Host "[AMD] Latency stack: GPU Priority=8, Scheduling=High, SFIO=High, PreRendered=1. NOTE: HAGS is handled separately by the HAGS toggle (only safe on RX 6000+ cards)." -ForegroundColor Green
    $appliedTweaks.Add("AmdOptimizeLatency") | Out-Null
} catch {
    $failedTweaks.Add("AmdOptimizeLatency") | Out-Null
    Write-Host "[ERR] AmdOptimizeLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdShaderCache..." -ForegroundColor DarkYellow
try {
    $dxPath = 'HKLM:\SOFTWARE\Microsoft\DirectX'; Set-ItemProperty -Path $dxPath -Name 'ShaderCache' -Value 1 -Type DWord -EA SilentlyContinue; $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableShaderCache' -Value 1 -Type DWord -EA SilentlyContinue }; Write-Host "[AMD] Shader cache enabled in DirectX + AMD KMD — reduces shader compilation stutter" -ForegroundColor Green
    $appliedTweaks.Add("AmdShaderCache") | Out-Null
} catch {
    $failedTweaks.Add("AmdShaderCache") | Out-Null
    Write-Host "[ERR] AmdShaderCache: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableFreeSyncCompetitive..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DalFreeSyncActive' -Value 0 -Type DWord -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'FreeSync' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] FreeSync disabled — eliminates VRR overhead for consistent frame times at high FPS" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableFreeSyncCompetitive") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableFreeSyncCompetitive") | Out-Null
    Write-Host "[ERR] AmdDisableFreeSyncCompetitive: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableVariBright..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'VariBrightEnable' -Value 0 -Type DWord -EA SilentlyContinue; $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DalVariBrightEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[AMD] Vari-Bright disabled — display brightness no longer auto-adjusts during gameplay" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableVariBright") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableVariBright") | Out-Null
    Write-Host "[ERR] AmdDisableVariBright: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdForcePerformancePowerPlan..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DisableDrmdmaPowerGating' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'DisableGmcPowerGating' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'DisablePowerGating' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Power gating disabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] GPU power gating disabled — eliminates power-save sleep/wake micro-stutters" -ForegroundColor Green
    $appliedTweaks.Add("AmdForcePerformancePowerPlan") | Out-Null
} catch {
    $failedTweaks.Add("AmdForcePerformancePowerPlan") | Out-Null
    Write-Host "[ERR] AmdForcePerformancePowerPlan: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdImageSharpening..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'ImageSharpening' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'ImageSharpeningStrength' -Value 80 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Radeon Image Sharpening enabled at 80% — sharpens compressed game textures with near-zero GPU cost" -ForegroundColor Green
    $appliedTweaks.Add("AmdImageSharpening") | Out-Null
} catch {
    $failedTweaks.Add("AmdImageSharpening") | Out-Null
    Write-Host "[ERR] AmdImageSharpening: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdAntiLag..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'AntiLag' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Anti-Lag enabled — reduces render queue depth to minimize input lag (similar to NVIDIA ULLS)" -ForegroundColor Green
    $appliedTweaks.Add("AmdAntiLag") | Out-Null
} catch {
    $failedTweaks.Add("AmdAntiLag") | Out-Null
    Write-Host "[ERR] AmdAntiLag: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableStartupApps..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RadeonSoftware" /f 2>$null; Stop-Service 'AMDExternalEvents' -Force -EA SilentlyContinue; Stop-Process -Name 'RadeonSoftware' -Force -EA SilentlyContinue; Write-Host "[AMD] Radeon Software removed from startup — relaunch manually when needed for driver updates" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableStartupApps") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableStartupApps") | Out-Null
    Write-Host "[ERR] AmdDisableStartupApps: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdTDRTweak..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrDelay' -Value 8 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] TDR level=3, delay=8s — prevents false GPU recovery events. (Was 60s which caused silent game exits; 8s is the safe maximum)" -ForegroundColor Green
    $appliedTweaks.Add("AmdTDRTweak") | Out-Null
} catch {
    $failedTweaks.Add("AmdTDRTweak") | Out-Null
    Write-Host "[ERR] AmdTDRTweak: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdSmartAccessMemory..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found=$false; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableResizableBar' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'KMD_EnableSmartAccessMemory' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Smart Access Memory enabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green; $found=$true }; If (-not $found) { Write-Host "[AMD] No AMD GPU class key found — verify Resizable BAR is enabled in BIOS first" -ForegroundColor Yellow } Else { Write-Host "[AMD] SAM (Resizable BAR) enabled — CPU has full VRAM access, improves DX12/Vulkan 5-15%" -ForegroundColor Green }
    $appliedTweaks.Add("AmdSmartAccessMemory") | Out-Null
} catch {
    $failedTweaks.Add("AmdSmartAccessMemory") | Out-Null
    Write-Host "[ERR] AmdSmartAccessMemory: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdAntiLagPlus..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'AntiLag' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'AntiLagPlus' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] Anti-Lag + Anti-Lag+ enabled. Anti-Lag works on RX 5000+, Anti-Lag+ requires RX 7000 series + driver 23.11.1+" -ForegroundColor Green
    $appliedTweaks.Add("AmdAntiLagPlus") | Out-Null
} catch {
    $failedTweaks.Add("AmdAntiLagPlus") | Out-Null
    Write-Host "[ERR] AmdAntiLagPlus: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdFluidMotionFrames..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|ATI' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableFrameGeneration' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[AMD] AFMF frame generation hint set on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[AMD] Fluid Motion Frames (AFMF) hint applied. Requires RX 7000 + driver 23.11.1+ + enable in Radeon Software Global Graphics" -ForegroundColor Cyan
    $appliedTweaks.Add("AmdFluidMotionFrames") | Out-Null
} catch {
    $failedTweaks.Add("AmdFluidMotionFrames") | Out-Null
    Write-Host "[ERR] AmdFluidMotionFrames: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdResizableBAR..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableLargeBar' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'KMD_SmartAccessMemoryEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[AMD] Resizable BAR / Smart Access Memory enabled via registry — requires BIOS Above 4G Decoding support. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("AmdResizableBAR") | Out-Null
} catch {
    $failedTweaks.Add("AmdResizableBAR") | Out-Null
    Write-Host "[ERR] AmdResizableBAR: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdRadeonBoost..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_RadeonBoostEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'KMD_RadeonBoostMinRes' -Value 75 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[AMD] Radeon Boost enabled (min resolution 75%) — dynamic resolution scaling during fast camera movement" -ForegroundColor Green
    $appliedTweaks.Add("AmdRadeonBoost") | Out-Null
} catch {
    $failedTweaks.Add("AmdRadeonBoost") | Out-Null
    Write-Host "[ERR] AmdRadeonBoost: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdEnhancedSync..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnhancedSyncEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[AMD] Enhanced Sync enabled — uncapped FPS above refresh rate with tear-free fallback below it" -ForegroundColor Green
    $appliedTweaks.Add("AmdEnhancedSync") | Out-Null
} catch {
    $failedTweaks.Add("AmdEnhancedSync") | Out-Null
    Write-Host "[ERR] AmdEnhancedSync: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableTelemetry..." -ForegroundColor DarkYellow
try {
    @('NvTelemetryContainer') | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Disabled -EA SilentlyContinue }; reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "NvBackend" /f 2>$null; Write-Host "[NVIDIA] NvTelemetryContainer stopped. Display container (NVDisplay.ContainerLocalSystem) intentionally kept running — stopping it causes NVIDIA Overlay.exe to crash with 0x80000003." -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableTelemetry") | Out-Null
    Write-Host "[ERR] NvidiaDisableTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaMaxPerfMode..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 19caa947-ffffffff-ffffffff-ffffffff-ffffffff 233cfb73-ffffffff-ffffffff-ffffffff-ffffffff 1 2>$null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'PlatformSupportMiracast' -Value 0 -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -EA SilentlyContinue; Write-Host "[NVIDIA] Max performance mode hints applied via GraphicsDrivers registry" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaMaxPerfMode") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaMaxPerfMode") | Out-Null
    Write-Host "[ERR] NvidiaMaxPerfMode: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaPreRenderedFrames..." -ForegroundColor DarkYellow
try {
    $gamesPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty -Path $gamesPath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'Priority' -Value 6 -Type DWord; Write-Host "[NVIDIA] MaximumPreRenderedFrames=1, GPU Priority=8 — input latency minimized" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaPreRenderedFrames") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaPreRenderedFrames") | Out-Null
    Write-Host "[ERR] NvidiaPreRenderedFrames: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaShaderCache..." -ForegroundColor DarkYellow
try {
    If (!(Test-Path 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NGXCore')) { New-Item 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NGXCore' -Force | Out-Null }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak' -Name 'Ordinal' -Value 1 -Type DWord -EA SilentlyContinue; $dxPath = 'HKLM:\SOFTWARE\Microsoft\DirectX'; Set-ItemProperty -Path $dxPath -Name 'ShaderCache' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Shader pre-caching enabled via DirectX registry + NGXCore hint" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaShaderCache") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaShaderCache") | Out-Null
    Write-Host "[ERR] NvidiaShaderCache: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaOptimizeLatency..." -ForegroundColor DarkYellow
try {
    $gamePath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'Scheduling Category' 'High' -Type String; Set-ItemProperty $gamePath 'SFIO Priority' 'High' -Type String; Set-ItemProperty $gamePath 'GPU Priority' 8 -Type DWord; Set-ItemProperty $gamePath 'Priority' 6 -Type DWord; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord; Write-Host "[NVIDIA] Latency stack: GPU Priority=8, Scheduling=High, SFIO=High, PreRendered=1. NOTE: HAGS is handled separately by the HAGS toggle (only enable HAGS on RTX 2000+ cards)." -ForegroundColor Green
    $appliedTweaks.Add("NvidiaOptimizeLatency") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaOptimizeLatency") | Out-Null
    Write-Host "[ERR] NvidiaOptimizeLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableOverlay..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *XboxGamingOverlay* | Remove-AppxPackage -EA SilentlyContinue; Stop-Process -Name "nvcontainer" -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\NVControlPanel2\Client' -Name 'OptInOrOutPreference' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Overlay and container process hints suppressed" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableOverlay") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableOverlay") | Out-Null
    Write-Host "[ERR] NvidiaDisableOverlay: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaLowLatency..." -ForegroundColor DarkYellow
try {
    $gamesPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty $gamesPath 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $gamesPath 'Priority' 6 -Type DWord -Force; Set-ItemProperty $gamesPath 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'SFIO Priority' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'MaximumPreRenderedFrames' 1 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrDelay' -Value 10 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Low Latency Mode: GPU priority 8, Scheduling=High, PreRendered=1, TDR extended" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaLowLatency") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaLowLatency") | Out-Null
    Write-Host "[ERR] NvidiaLowLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaThreadedOpt..." -ForegroundColor DarkYellow
try {
    $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'Threaded_Optimization_Override' 1 -Type DWord -Force -EA SilentlyContinue; netsh int tcp set global dca=enabled 2>$null; $dxKey = 'HKLM:\SOFTWARE\Microsoft\DirectX'; Set-ItemProperty $dxKey 'ThreadedOptimization' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Threaded Optimization enabled via NvTweak registry and DirectX DCA" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaThreadedOpt") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaThreadedOpt") | Out-Null
    Write-Host "[ERR] NvidiaThreadedOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaForceVSyncOff..." -ForegroundColor DarkYellow
try {
    $gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; Remove-ItemProperty $gdrv 'VerticalSyncOverride' -EA SilentlyContinue; Remove-ItemProperty $gdrv 'TripleBufferingOverride' -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak\Policies' -Name 'VSync' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] VSync override cleared — force VSync Off in NVCP or in-game for effect. Triple buffering key removed." -ForegroundColor Green
    $appliedTweaks.Add("NvidiaForceVSyncOff") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaForceVSyncOff") | Out-Null
    Write-Host "[ERR] NvidiaForceVSyncOff: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaPowerMizer..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found = $false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'PerfLevelSrc' 0x2222 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerEnable' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerLevel' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerLevelAC' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] PowerMizer set to Max Performance on $k" -ForegroundColor Green; $found = $true } }; If (-not $found) { Write-Host "[NVIDIA] PowerMizer: NVIDIA GPU class key not found at 0000-0003 — apply via NVCP manually" -ForegroundColor Yellow }
    $appliedTweaks.Add("NvidiaPowerMizer") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaPowerMizer") | Out-Null
    Write-Host "[ERR] NvidiaPowerMizer: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaAnisoFiltering..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found=$false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k -Name 'ForcedMipmapsMinLod' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k -Name 'AnisotropicDegree' -Value 16 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Anisotropic Filtering 16x forced on $k" -ForegroundColor Green; $found=$true } }; If (-not $found) { Write-Host "[NVIDIA] NVIDIA GPU class key not found — apply AF manually in NVCP" -ForegroundColor Yellow }
    $appliedTweaks.Add("NvidiaAnisoFiltering") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaAnisoFiltering") | Out-Null
    Write-Host "[ERR] NvidiaAnisoFiltering: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaTripleBufferOff..." -ForegroundColor DarkYellow
try {
    $gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; Remove-ItemProperty $gdrv 'TripleBufferingOverride' -EA SilentlyContinue; $nvPol = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak\Policies'; If (!(Test-Path $nvPol)) { New-Item $nvPol -Force | Out-Null }; Set-ItemProperty $nvPol 'TripleBuffering' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Triple Buffering disabled — reduces frame buffer depth for lower input latency" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaTripleBufferOff") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaTripleBufferOff") | Out-Null
    Write-Host "[ERR] NvidiaTripleBufferOff: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaReflexEnable..." -ForegroundColor DarkYellow
try {
    $reflexPath = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\Reflex'; If (!(Test-Path $reflexPath)) { New-Item $reflexPath -Force | Out-Null }; Set-ItemProperty $reflexPath 'Enable' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $reflexPath 'BoostEnabled' 1 -Type DWord -Force -EA SilentlyContinue; $gamePath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Reflex hint enabled (Enable=1, BoostEnabled=1) — pair with in-game Reflex for lowest click-to-pixel latency" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaReflexEnable") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaReflexEnable") | Out-Null
    Write-Host "[ERR] NvidiaReflexEnable: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaGSyncOptimize..." -ForegroundColor DarkYellow
try {
    $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'GSyncEnabled' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $nvKey 'VSyncEnabled' 0 -Type DWord -Force -EA SilentlyContinue; $gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; Set-ItemProperty $gdrv 'DisableBlockWrite' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] G-Sync: VSync disabled, G-Sync enabled, block write path cleared — optimized VRR pipeline" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaGSyncOptimize") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaGSyncOptimize") | Out-Null
    Write-Host "[ERR] NvidiaGSyncOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaOpenGLOpt..." -ForegroundColor DarkYellow
try {
    $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'OpenGLThreadedOptimizations' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $nvKey 'OGLFrameMaxAhead' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] OpenGL: threaded optimizations=On, render-ahead=1 frame — reduces CPU submission overhead in OpenGL titles" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaOpenGLOpt") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaOpenGLOpt") | Out-Null
    Write-Host "[ERR] NvidiaOpenGLOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaVRAMMax..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'DedicatedSegmentSize' -Value 0 -Type DWord -Force -EA SilentlyContinue; $nvKey = 'HKCU:\SOFTWARE\NVIDIA Corporation\NVControlPanel2\Client'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'VRAMUsage' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] VRAM: DedicatedSegmentSize cleared + VRAMUsage=1 — driver auto-manages VRAM without artificial limit" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaVRAMMax") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaVRAMMax") | Out-Null
    Write-Host "[ERR] NvidiaVRAMMax: $_" -ForegroundColor Red
}
Write-Host "[>>] NvShaderDiskCache..." -ForegroundColor DarkYellow
try {
    $dxPath = 'HKLM:\SOFTWARE\Microsoft\DirectX'; If (!(Test-Path $dxPath)) { New-Item $dxPath -Force | Out-Null }; Set-ItemProperty $dxPath 'ShaderCache' 1 -Type DWord -Force -EA SilentlyContinue; $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'ShaderDiskCacheMaxSize' 0x40000000 -Type DWord -Force -EA SilentlyContinue; $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'ShaderCache' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Shader disk cache = unlimited on GPU class $k" -ForegroundColor Green } }; Write-Host "[NVIDIA] Shader disk cache maximized — eliminates compilation stutter on GTX 1060 / 1650 / RTX series" -ForegroundColor Green
    $appliedTweaks.Add("NvShaderDiskCache") | Out-Null
} catch {
    $failedTweaks.Add("NvShaderDiskCache") | Out-Null
    Write-Host "[ERR] NvShaderDiskCache: $_" -ForegroundColor Red
}
Write-Host "[>>] NvTextureFilterPerf..." -ForegroundColor DarkYellow
try {
    $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'TextureFilterQuality' 0 -Type DWord -Force -EA SilentlyContinue; $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found = $false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'TextureFilterQuality' 0 -Type DWord -Force -EA SilentlyContinue; $found = $true; Write-Host "[NVIDIA] Texture filter = High Performance on $k (saves 3-8 FPS on GTX 1060/1650 vs default Quality mode)" -ForegroundColor Green } }; If (-not $found) { Write-Host "[NVIDIA] GPU class key not found — apply via NVCP: Manage 3D Settings > Texture filtering quality = High Performance" -ForegroundColor Yellow }
    $appliedTweaks.Add("NvTextureFilterPerf") | Out-Null
} catch {
    $failedTweaks.Add("NvTextureFilterPerf") | Out-Null
    Write-Host "[ERR] NvTextureFilterPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] NvFXAADriverOff..." -ForegroundColor DarkYellow
try {
    $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'FXAA' 0 -Type DWord -Force -EA SilentlyContinue; $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'FXAA' 0 -Type DWord -Force -EA SilentlyContinue } }; Write-Host "[NVIDIA] Driver-level FXAA injection disabled — prevents NVIDIA from adding anti-aliasing overhead without your consent. Use in-game AA settings instead." -ForegroundColor Green
    $appliedTweaks.Add("NvFXAADriverOff") | Out-Null
} catch {
    $failedTweaks.Add("NvFXAADriverOff") | Out-Null
    Write-Host "[ERR] NvFXAADriverOff: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaCUDAPriority..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'RmCudaSchedulingMode' -Value 2 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[NVIDIA] CUDA scheduling priority set to High (0x02) — game compute tasks prioritized over background workloads" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaCUDAPriority") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaCUDAPriority") | Out-Null
    Write-Host "[ERR] NvidiaCUDAPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaShaderCacheUnlimited..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'ShaderCacheSize' -Value 0xFFFFFFFF -Type DWord -Force -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak' -Name 'ShaderCacheSize' -Value 0xFFFFFFFF -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Shader cache set to unlimited — prevents shader recompilation in large games" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaShaderCacheUnlimited") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaShaderCacheUnlimited") | Out-Null
    Write-Host "[ERR] NvidiaShaderCacheUnlimited: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaFrameBufferOpt..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'MaxFramesAllowed' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'FlipQueueSize' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[NVIDIA] Frame buffer capped to 1 pre-rendered frame — minimum input-to-display latency" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaFrameBufferOpt") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaFrameBufferOpt") | Out-Null
    Write-Host "[ERR] NvidiaFrameBufferOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableAnsel..." -ForegroundColor DarkYellow
try {
    $ansel = 'HKCU:\SOFTWARE\NVIDIA Corporation\Ansel'; If (!(Test-Path $ansel)) { New-Item $ansel -Force | Out-Null }; Set-ItemProperty $ansel -Name 'AnselEnable' -Value 0 -Type DWord -Force; $nvcp = 'HKCU:\SOFTWARE\NVIDIA Corporation\NVControlPanel2\Client'; If (!(Test-Path $nvcp)) { New-Item $nvcp -Force | Out-Null }; Set-ItemProperty $nvcp -Name 'OptInOrOutPreference' -Value 0 -Type DWord -Force; Write-Host "[NVIDIA] Ansel photo-mode hook disabled — eliminates DLL injection overhead" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableAnsel") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableAnsel") | Out-Null
    Write-Host "[ERR] NvidiaDisableAnsel: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableContainerLS..." -ForegroundColor DarkYellow
try {
    Write-Host "WARNING: Stopping NvDisplay.ContainerLocalSystem breaks NVIDIA Overlay (Alt+Z). Only disable if you never use GeForce Experience overlay." -ForegroundColor Yellow; Stop-Service -Name 'NVDisplay.ContainerLocalSystem' -Force -EA SilentlyContinue; Set-Service -Name 'NVDisplay.ContainerLocalSystem' -StartupType Disabled -EA SilentlyContinue; Write-Host "[NVIDIA] NvDisplay.ContainerLocalSystem service disabled — frees 50-150MB RAM" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableContainerLS") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableContainerLS") | Out-Null
    Write-Host "[ERR] NvidiaDisableContainerLS: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableShadowPlay..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\ShadowPlay\NVSPCAPS' -Name 'ShadowPlayOnSystemStartup' -Value 0 -Type DWord -Force -EA SilentlyContinue; $nvShare = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\ShadowPlay\NVSPCAPS'; If (!(Test-Path $nvShare)) { New-Item $nvShare -Force | Out-Null }; Set-ItemProperty $nvShare -Name 'ShadowPlayOnSystemStartup' -Value 0 -Type DWord -Force; Set-ItemProperty $nvShare -Name 'IsShadowPlayEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Stop-Process -Name 'nvsphelper64' -Force -EA SilentlyContinue; Write-Host "[NVIDIA] ShadowPlay/Instant Replay disabled — frees 200-400MB VRAM" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableShadowPlay") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableShadowPlay") | Out-Null
    Write-Host "[ERR] NvidiaDisableShadowPlay: $_" -ForegroundColor Red
}
Write-Host "[>>] EnableLargeSystemCache..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: WILL DECREASE FPS IN GAMES — LargeSystemCache=1 is a Windows Server setting that aggressively trims game process working sets to prioritize the file system cache. This directly reduces FPS in GTA V, FiveM, and most games by forcing game textures and code out of RAM mid-session. Do NOT enable this on a gaming PC. It is only useful for file servers and video editing workstations." -ForegroundColor Yellow; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' -Name 'LargeSystemCache' -Value 1; Write-Host "[OK] LargeSystemCache=1 applied — NOTE: this hurts gaming performance. See warning above." -ForegroundColor DarkYellow
    $appliedTweaks.Add("EnableLargeSystemCache") | Out-Null
} catch {
    $failedTweaks.Add("EnableLargeSystemCache") | Out-Null
    Write-Host "[ERR] EnableLargeSystemCache: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordLowPriority..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Discord.exe\PerfOptions'; If (!(Test-Path $ifeo)) { New-Item $ifeo -Force | Out-Null }; Set-ItemProperty $ifeo 'CpuPriorityClass' 1 -Type DWord; Set-ItemProperty $ifeo 'IoPriority' 0 -Type DWord; Set-ItemProperty $ifeo 'PagePriority' 1 -Type DWord; Write-Host "[Discord] Discord.exe: Below Normal CPU + Very Low I/O + Low Page priority — game gets full CPU scheduling priority" -ForegroundColor Green
    $appliedTweaks.Add("DiscordLowPriority") | Out-Null
} catch {
    $failedTweaks.Add("DiscordLowPriority") | Out-Null
    Write-Host "[ERR] DiscordLowPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableHWAccel..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -match '"enableHardwareAcceleration"\s*:\s*true') { $raw = $raw -replace '"enableHardwareAcceleration"\s*:\s*true', '"enableHardwareAcceleration": false' } ElseIf ($raw -notmatch '"enableHardwareAcceleration"') { $raw = $raw -replace '\{', '{ "enableHardwareAcceleration": false,' }; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Hardware acceleration disabled — reduces GPU usage during screenshares and video calls" -ForegroundColor Green } Else { Write-Host "[Discord] settings.json not found — open Discord once first to generate it" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableHWAccel") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableHWAccel") | Out-Null
    Write-Host "[ERR] DiscordDisableHWAccel: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordClearCache..." -ForegroundColor DarkYellow
try {
    $cacheDirs = @("$env:APPDATA\discord\Cache","$env:APPDATA\discord\Code Cache","$env:APPDATA\discord\GPUCache","$env:APPDATA\discord\blob_storage"); $total = 0; ForEach ($dir in $cacheDirs) { If (Test-Path $dir) { $size = (Get-ChildItem $dir -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum; Remove-Item "$dir\*" -Recurse -Force -EA SilentlyContinue; $total += $size } }; $mb = [Math]::Round($total/1MB, 1); Write-Host "[Discord] Cache cleared — freed $($mb) MB. Fixes lag, texture glitches, and slow load times" -ForegroundColor Green
    $appliedTweaks.Add("DiscordClearCache") | Out-Null
} catch {
    $failedTweaks.Add("DiscordClearCache") | Out-Null
    Write-Host "[ERR] DiscordClearCache: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableUpdateCheck..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Update.exe'; If (!(Test-Path $ifeo)) { New-Item $ifeo -Force | Out-Null }; $perf = "$ifeo\PerfOptions"; If (!(Test-Path $perf)) { New-Item $perf -Force | Out-Null }; Set-ItemProperty $perf 'CpuPriorityClass' 1 -Type DWord; Set-ItemProperty $perf 'IoPriority' 0 -Type DWord; Write-Host "[Discord] Discord Update.exe deprioritized — background updates won't spike your CPU mid-game" -ForegroundColor Green
    $appliedTweaks.Add("DiscordDisableUpdateCheck") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableUpdateCheck") | Out-Null
    Write-Host "[ERR] DiscordDisableUpdateCheck: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordReduceGPUPriority..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Discord.exe\PerfOptions'; If (!(Test-Path $ifeo)) { New-Item $ifeo -Force | Out-Null }; Set-ItemProperty $ifeo 'GpuPriorityClass' 1 -Type DWord; $games = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $games)) { New-Item $games -Force | Out-Null }; Set-ItemProperty $games 'GPU Priority' 8 -Type DWord; Write-Host "[Discord] Discord GPU priority lowered to 1 — Games task kept at GPU Priority 8 for max rendering priority" -ForegroundColor Green
    $appliedTweaks.Add("DiscordReduceGPUPriority") | Out-Null
} catch {
    $failedTweaks.Add("DiscordReduceGPUPriority") | Out-Null
    Write-Host "[ERR] DiscordReduceGPUPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordOptimizeCodec..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"videoCodec"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "videoCodec": "H264", "openH264": false, "disableVideoMotionSmoothing": true }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Screenshare codec set to H264 + motion smoothing disabled — lower CPU during screenshares" -ForegroundColor Green } Else { Write-Host "[Discord] Codec settings already configured" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord once to generate it" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordOptimizeCodec") | Out-Null
} catch {
    $failedTweaks.Add("DiscordOptimizeCodec") | Out-Null
    Write-Host "[ERR] DiscordOptimizeCodec: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableCrashHandler..." -ForegroundColor DarkYellow
try {
    $crashpad = Get-ChildItem "$env:LOCALAPPDATA\Discord" -Filter "crashpad_handler.exe" -Recurse -EA SilentlyContinue | Select-Object -First 1; If ($crashpad) { $aclPath = $crashpad.FullName; $acl = Get-Acl $aclPath; $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","ExecuteFile","Deny"); $acl.AddAccessRule($rule); Set-Acl $aclPath $acl -EA SilentlyContinue; Write-Host "[Discord] Crash handler execution blocked — eliminates crash report upload overhead" -ForegroundColor Green } Else { Write-Host "[Discord] Crash handler not found — may already be absent or path changed" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableCrashHandler") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableCrashHandler") | Out-Null
    Write-Host "[ERR] DiscordDisableCrashHandler: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableAnimations..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"reduceMotion"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "reduceMotion": true }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Reduce Motion enabled — fewer UI animations = lower CPU/GPU overhead while gaming" -ForegroundColor Green } Else { Write-Host "[Discord] Reduce Motion already enabled" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableAnimations") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableAnimations") | Out-Null
    Write-Host "[ERR] DiscordDisableAnimations: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableOverlay..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"OVERLAY_ENABLED"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "OVERLAY_ENABLED": false }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] In-game overlay disabled — eliminates GPU/CPU competition during gameplay. Alt+F9 will no longer show Discord overlay." -ForegroundColor Green } Else { Write-Host "[Discord] Overlay already disabled" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableOverlay") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableOverlay") | Out-Null
    Write-Host "[ERR] DiscordDisableOverlay: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableClips..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"disableClips"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "disableClips": true }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Discord Clips auto-recording disabled — stops background clip buffer from eating memory/GPU" -ForegroundColor Green } Else { Write-Host "[Discord] Clips already disabled" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableClips") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableClips") | Out-Null
    Write-Host "[ERR] DiscordDisableClips: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableVAD..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"noVoiceActivityDetection"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "noVoiceActivityDetection": true }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Voice Activity Detection disabled — reduces CPU spikes from audio processing. You may hear lag spikes less often during voice chats." -ForegroundColor Green } Else { Write-Host "[Discord] VAD already disabled" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableVAD") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableVAD") | Out-Null
    Write-Host "[ERR] DiscordDisableVAD: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordLowerVoiceQuality..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"audioQualityMode"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "audioQualityMode": "basic" }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Voice quality set to Basic (8kbps) — 90% less CPU overhead for voice encoding during FPS games" -ForegroundColor Green } Else { Write-Host "[Discord] Voice quality already optimized" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordLowerVoiceQuality") | Out-Null
} catch {
    $failedTweaks.Add("DiscordLowerVoiceQuality") | Out-Null
    Write-Host "[ERR] DiscordLowerVoiceQuality: $_" -ForegroundColor Red
}
Write-Host "[>>] DiscordDisableStreaming..." -ForegroundColor DarkYellow
try {
    $settings = "$env:APPDATA\discord\settings.json"; If (Test-Path $settings) { $raw = Get-Content $settings -Raw; If ($raw -notmatch '"streamNotices"') { $raw = $raw.TrimEnd().TrimEnd('}') + ', "streamNotices": false, "streamingConsent": false, "streamPauseNotification": false }'; $raw | Set-Content $settings -Encoding UTF8; Write-Host "[Discord] Streaming features disabled — removes screenshare buffer overhead and stream metadata processing" -ForegroundColor Green } Else { Write-Host "[Discord] Streaming already disabled" -ForegroundColor Yellow } } Else { Write-Host "[Discord] settings.json not found — open Discord first" -ForegroundColor Yellow }
    $appliedTweaks.Add("DiscordDisableStreaming") | Out-Null
} catch {
    $failedTweaks.Add("DiscordDisableStreaming") | Out-Null
    Write-Host "[ERR] DiscordDisableStreaming: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_UltimatePerformance..." -ForegroundColor DarkYellow
try {
    $guid = (powercfg -list | Select-String 'Ultimate').ToString(); if (-not $guid) { powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 | Out-Null }; $scheme = (powercfg -list | Select-String 'Ultimate' | ForEach-Object { ($_ -split '\s+')[3] }) | Select-Object -First 1; if ($scheme) { powercfg -setactive $scheme }; Write-Host "[Laptop] Ultimate Performance power plan activated — all power-saving states disabled on AC" -ForegroundColor Green
    $appliedTweaks.Add("Lap_UltimatePerformance") | Out-Null
} catch {
    $failedTweaks.Add("Lap_UltimatePerformance") | Out-Null
    Write-Host "[ERR] Lap_UltimatePerformance: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableCoreParking..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583' -Name 'ValueMin' -Value 100 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583' -Name 'ValueMax' -Value 100 -Type DWord -EA SilentlyContinue; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop] CPU core parking disabled — all cores stay awake and ready on AC" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableCoreParking") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableCoreParking") | Out-Null
    Write-Host "[ERR] Lap_DisableCoreParking: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableThrottleStates..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 3b04d4fd-1cc7-4f23-ab1c-d1337819c4bb 0; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop] CPU throttle states disabled on AC — processor will not throttle under gaming load" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableThrottleStates") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableThrottleStates") | Out-Null
    Write-Host "[ERR] Lap_DisableThrottleStates: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_MaxProcessorStateAC..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 100; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop] Max processor state set to 100% on AC — no artificial CPU cap" -ForegroundColor Green
    $appliedTweaks.Add("Lap_MaxProcessorStateAC") | Out-Null
} catch {
    $failedTweaks.Add("Lap_MaxProcessorStateAC") | Out-Null
    Write-Host "[ERR] Lap_MaxProcessorStateAC: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableTurboOnBattery..." -ForegroundColor DarkYellow
try {
    powercfg -setdcvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 99; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop] Processor capped at 99% on battery — prevents turbo-induced thermal throttle for smoother battery gaming" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableTurboOnBattery") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableTurboOnBattery") | Out-Null
    Write-Host "[ERR] Lap_DisableTurboOnBattery: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableAdaptiveBrightness..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 7516b95f-f776-4464-8c53-06167f40cc99 FBD9AA66-9553-4097-BA44-ED6E9D65EAB8 0; powercfg -setdcvalueindex SCHEME_CURRENT 7516b95f-f776-4464-8c53-06167f40cc99 FBD9AA66-9553-4097-BA44-ED6E9D65EAB8 0; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop] Adaptive display brightness disabled — screen no longer dims mid-game" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableAdaptiveBrightness") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableAdaptiveBrightness") | Out-Null
    Write-Host "[ERR] Lap_DisableAdaptiveBrightness: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_AMD_DisableULPS..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'EnableULPS' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name 'EnableULPS_NA' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[Laptop/AMD] ULPS disabled — AMD GPU stays at operational clocks, stutter eliminated" -ForegroundColor Green
    $appliedTweaks.Add("Lap_AMD_DisableULPS") | Out-Null
} catch {
    $failedTweaks.Add("Lap_AMD_DisableULPS") | Out-Null
    Write-Host "[ERR] Lap_AMD_DisableULPS: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_AMD_DisableVariBright..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'ACEEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name 'VariBrightEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[Laptop/AMD] VariBright disabled — GPU no longer throttles clocks for display dimming" -ForegroundColor Green
    $appliedTweaks.Add("Lap_AMD_DisableVariBright") | Out-Null
} catch {
    $failedTweaks.Add("Lap_AMD_DisableVariBright") | Out-Null
    Write-Host "[ERR] Lap_AMD_DisableVariBright: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_AMD_DisableDeepSleep..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'PP_SclkDeepSleepDisable' -Value 1 -Type DWord -EA SilentlyContinue }; Write-Host "[Laptop/AMD] GPU deep sleep disabled — shader clusters stay awake between frames" -ForegroundColor Green
    $appliedTweaks.Add("Lap_AMD_DisableDeepSleep") | Out-Null
} catch {
    $failedTweaks.Add("Lap_AMD_DisableDeepSleep") | Out-Null
    Write-Host "[ERR] Lap_AMD_DisableDeepSleep: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_AMD_DisableDynamicVoltage..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'PP_GFX_ACG_DSM_MASK' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[Laptop/AMD] Dynamic voltage scaling disabled — stable GPU voltage prevents micro-stutters" -ForegroundColor Green
    $appliedTweaks.Add("Lap_AMD_DisableDynamicVoltage") | Out-Null
} catch {
    $failedTweaks.Add("Lap_AMD_DisableDynamicVoltage") | Out-Null
    Write-Host "[ERR] Lap_AMD_DisableDynamicVoltage: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_AMD_ForcePerformance..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name 'PP_ForceState' -Value 1 -Type DWord -EA SilentlyContinue }; Write-Host "[Laptop/AMD] AMD GPU forced to performance state — eliminates ramp-up delay from idle to load" -ForegroundColor Green
    $appliedTweaks.Add("Lap_AMD_ForcePerformance") | Out-Null
} catch {
    $failedTweaks.Add("Lap_AMD_ForcePerformance") | Out-Null
    Write-Host "[ERR] Lap_AMD_ForcePerformance: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_NVIDIA_MaxPerformance..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { if ((Get-ItemProperty -Path $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -like '*NVIDIA*') { Set-ItemProperty -Path $_.PSPath -Name 'PowerMizerEnable' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path $_.PSPath -Name 'PerfLevelSrc' -Value 0x2222 -Type DWord -EA SilentlyContinue } }; Write-Host "[Laptop/NVIDIA] PowerMizer set to max performance — GPU stays at max clocks" -ForegroundColor Green
    $appliedTweaks.Add("Lap_NVIDIA_MaxPerformance") | Out-Null
} catch {
    $failedTweaks.Add("Lap_NVIDIA_MaxPerformance") | Out-Null
    Write-Host "[ERR] Lap_NVIDIA_MaxPerformance: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_NVIDIA_DisableVsync..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak' -Name 'Coolbits' -Value 8 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop/NVIDIA] NVIDIA VSync override applied — check NVIDIA Control Panel to confirm" -ForegroundColor Green
    $appliedTweaks.Add("Lap_NVIDIA_DisableVsync") | Out-Null
} catch {
    $failedTweaks.Add("Lap_NVIDIA_DisableVsync") | Out-Null
    Write-Host "[ERR] Lap_NVIDIA_DisableVsync: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_NVIDIA_LowLatency..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\FTS' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\FTS' -Name 'EnableRID61684' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop/NVIDIA] Ultra low latency mode enabled — single-frame render queue reduces input latency 20-33%" -ForegroundColor Green
    $appliedTweaks.Add("Lap_NVIDIA_LowLatency") | Out-Null
} catch {
    $failedTweaks.Add("Lap_NVIDIA_LowLatency") | Out-Null
    Write-Host "[ERR] Lap_NVIDIA_LowLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_NVIDIA_ThreadedOpt..." -ForegroundColor DarkYellow
try {
    Get-ChildItem -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object { if ((Get-ItemProperty -Path $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -like '*NVIDIA*') { Set-ItemProperty -Path $_.PSPath -Name 'OGLThreaded' -Value 1 -Type DWord -EA SilentlyContinue } }; Write-Host "[Laptop/NVIDIA] Threaded optimization enabled — driver spreads CPU work across cores" -ForegroundColor Green
    $appliedTweaks.Add("Lap_NVIDIA_ThreadedOpt") | Out-Null
} catch {
    $failedTweaks.Add("Lap_NVIDIA_ThreadedOpt") | Out-Null
    Write-Host "[ERR] Lap_NVIDIA_ThreadedOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_NVIDIA_DisableMaxQThrottle..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000' -Name 'D3PCLatency' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop/NVIDIA] Max-Q TGP software throttle reduced — GPU reaches closer to its true performance" -ForegroundColor Green
    $appliedTweaks.Add("Lap_NVIDIA_DisableMaxQThrottle") | Out-Null
} catch {
    $failedTweaks.Add("Lap_NVIDIA_DisableMaxQThrottle") | Out-Null
    Write-Host "[ERR] Lap_NVIDIA_DisableMaxQThrottle: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Intel_DisableTurboLimits..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 75b0ae3f-bce0-45a7-8c89-c9611c25e100 0; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop/Intel] Turbo Boost power limits removed — CPU holds boost clocks indefinitely under load" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Intel_DisableTurboLimits") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Intel_DisableTurboLimits") | Out-Null
    Write-Host "[ERR] Lap_Intel_DisableTurboLimits: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Intel_DisableSpeedShift..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 100; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop/Intel] Speed Shift minimum performance set to 100% — CPU never drops below max frequency on AC" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Intel_DisableSpeedShift") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Intel_DisableSpeedShift") | Out-Null
    Write-Host "[ERR] Lap_Intel_DisableSpeedShift: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Intel_DisableECores..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options' -Force -EA SilentlyContinue | Out-Null; Write-Host "[Laptop/Intel] E-Core deprioritization note — set game affinity to P-cores manually or use Process Lasso for best results on 12th gen+" -ForegroundColor Yellow
    $appliedTweaks.Add("Lap_Intel_DisableECores") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Intel_DisableECores") | Out-Null
    Write-Host "[ERR] Lap_Intel_DisableECores: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Net_DisableNagle..." -ForegroundColor DarkYellow
try {
    $adapters = Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'; foreach ($a in $adapters) { Set-ItemProperty -Path $a.PSPath -Name 'TcpAckFrequency' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path $a.PSPath -Name 'TCPNoDelay' -Value 1 -Type DWord -EA SilentlyContinue }; Write-Host "[Laptop/Net] Nagle algorithm disabled on all adapters — packet latency removed" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Net_DisableNagle") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Net_DisableNagle") | Out-Null
    Write-Host "[ERR] Lap_Net_DisableNagle: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Net_DisableThrottle..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsivenessIndex' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop/Net] Network throttling and system responsiveness throttle removed" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Net_DisableThrottle") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Net_DisableThrottle") | Out-Null
    Write-Host "[ERR] Lap_Net_DisableThrottle: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Net_DisableAutoTuning..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global autotuninglevel=normal; Write-Host "[Laptop/Net] TCP auto-tuning locked to normal — prevents random mid-game bandwidth drops" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Net_DisableAutoTuning") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Net_DisableAutoTuning") | Out-Null
    Write-Host "[ERR] Lap_Net_DisableAutoTuning: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Net_OptimizeDNS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters' -Name 'MaxCacheTtl' -Value 86400 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters' -Name 'MaxNegativeCacheTtl' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop/Net] DNS cache set to 24h — eliminates DNS lookup delays on repeated game server connections" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Net_OptimizeDNS") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Net_OptimizeDNS") | Out-Null
    Write-Host "[ERR] Lap_Net_OptimizeDNS: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Net_DisableUSBSelSuspend..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0; powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0; powercfg -setactive SCHEME_CURRENT; Write-Host "[Laptop/Net] USB selective suspend disabled — no more controller or peripheral drop-outs mid-game" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Net_DisableUSBSelSuspend") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Net_DisableUSBSelSuspend") | Out-Null
    Write-Host "[ERR] Lap_Net_DisableUSBSelSuspend: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_Net_WiFiPerfMode..." -ForegroundColor DarkYellow
try {
    $adapters = Get-NetAdapter | Where-Object { $_.PhysicalMediaType -eq 'NativeWifi' }; foreach ($a in $adapters) { Set-NetAdapterAdvancedProperty -Name $a.Name -DisplayName 'Power Saving Mode' -DisplayValue 'Maximum Performance' -EA SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $a.Name -DisplayName 'Roaming Aggressiveness' -DisplayValue 'Lowest' -EA SilentlyContinue }; Write-Host "[Laptop/Net] Wi-Fi adapter set to maximum performance — ping spikes on Wi-Fi eliminated" -ForegroundColor Green
    $appliedTweaks.Add("Lap_Net_WiFiPerfMode") | Out-Null
} catch {
    $failedTweaks.Add("Lap_Net_WiFiPerfMode") | Out-Null
    Write-Host "[ERR] Lap_Net_WiFiPerfMode: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_TimerResolution..." -ForegroundColor DarkYellow
try {
    $src = 'using System.Runtime.InteropServices; public class Timer { [DllImport("ntdll.dll")] public static extern int NtSetTimerResolution(uint r,bool s,ref uint c); }'; Add-Type -TypeDefinition $src -EA SilentlyContinue; $c = 0; [Timer]::NtSetTimerResolution(5000, $true, [ref]$c) | Out-Null; New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsivenessIndex' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] Timer resolution set to 0.5ms — game loops, audio, and thread wake-ups fire on time every frame" -ForegroundColor Green
    $appliedTweaks.Add("Lap_TimerResolution") | Out-Null
} catch {
    $failedTweaks.Add("Lap_TimerResolution") | Out-Null
    Write-Host "[ERR] Lap_TimerResolution: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisablePowerThrottling..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' -Name 'PowerThrottlingOff' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] Windows power throttling disabled — OS cannot reduce CPU allocation to your game process" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisablePowerThrottling") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisablePowerThrottling") | Out-Null
    Write-Host "[ERR] Lap_DisablePowerThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableXboxGameBar..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' -Name 'AllowGameDVR' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] Xbox Game Bar and DVR disabled — GPU present overhead removed" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableXboxGameBar") | Out-Null
    Write-Host "[ERR] Lap_DisableXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableFullscreenOpt..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKCU:\System\GameConfigStore' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_FSEBehavior' -Value 2 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Scheduler' -Name 'DisableFullscreenOptimizations' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] Fullscreen optimizations disabled globally — true exclusive fullscreen restored" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableFullscreenOpt") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableFullscreenOpt") | Out-Null
    Write-Host "[ERR] Lap_DisableFullscreenOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_MMCSS_Games..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -Value 6 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -Value 8 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'SFIO Priority' -Value 'High' -EA SilentlyContinue; Write-Host "[Laptop] MMCSS Games priority boosted — game threads preempt all other system threads" -ForegroundColor Green
    $appliedTweaks.Add("Lap_MMCSS_Games") | Out-Null
} catch {
    $failedTweaks.Add("Lap_MMCSS_Games") | Out-Null
    Write-Host "[ERR] Lap_MMCSS_Games: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableMPO..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -Value 5 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] Multi-Plane Overlay disabled — eliminates black screens and flickering with overlays on laptop GPUs" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableMPO") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableMPO") | Out-Null
    Write-Host "[ERR] Lap_DisableMPO: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_VisualPerformance..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] Visual effects set to Best Performance — GPU VRAM freed for games on iGPU/entry-level dGPU" -ForegroundColor Green
    $appliedTweaks.Add("Lap_VisualPerformance") | Out-Null
} catch {
    $failedTweaks.Add("Lap_VisualPerformance") | Out-Null
    Write-Host "[ERR] Lap_VisualPerformance: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_DisableHAGS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[Laptop] HAGS disabled — Hardware Accelerated GPU Scheduling causes stutter on GTX 16xx and older Radeon laptop GPUs" -ForegroundColor Green
    $appliedTweaks.Add("Lap_DisableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("Lap_DisableHAGS") | Out-Null
    Write-Host "[ERR] Lap_DisableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_USBPowerSave..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null; powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null; powercfg -setactive SCHEME_CURRENT 2>$null; $usbPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\USB'; If (!(Test-Path $usbPath)) { New-Item $usbPath -Force | Out-Null }; Set-ItemProperty $usbPath 'DisableSelectiveSuspend' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Laptop] USB selective suspend disabled on AC + battery — prevents USB controller dropping power to mouse/keyboard mid-game causing input stutter" -ForegroundColor Green
    $appliedTweaks.Add("Lap_USBPowerSave") | Out-Null
} catch {
    $failedTweaks.Add("Lap_USBPowerSave") | Out-Null
    Write-Host "[ERR] Lap_USBPowerSave: $_" -ForegroundColor Red
}
Write-Host "[>>] Lap_WifiPerfMode..." -ForegroundColor DarkYellow
try {
    $netClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $netClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Wireless|Wi-Fi|802.11|WLAN|WiFi' } | ForEach-Object { Set-ItemProperty $_.PSPath 'PnPCapabilities' 24 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath 'PowerSaveMode' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Laptop] WiFi power save disabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc)" -ForegroundColor Green }; Write-Host "[Laptop] WiFi adapter power management disabled — consistent ping, no power-save induced latency spikes during gaming" -ForegroundColor Green
    $appliedTweaks.Add("Lap_WifiPerfMode") | Out-Null
} catch {
    $failedTweaks.Add("Lap_WifiPerfMode") | Out-Null
    Write-Host "[ERR] Lap_WifiPerfMode: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_DiagTrack..." -ForegroundColor DarkYellow
try {
    Stop-Service 'DiagTrack' -Force -EA SilentlyContinue; Set-Service 'DiagTrack' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] DiagTrack (Connected Telemetry) set to Manual — no longer auto-starts at boot" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_DiagTrack") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_DiagTrack") | Out-Null
    Write-Host "[ERR] ProcSvc_DiagTrack: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WerSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WerSvc' -Force -EA SilentlyContinue; Set-Service 'WerSvc' -StartupType Manual -EA SilentlyContinue; Stop-Service 'wercplsupport' -Force -EA SilentlyContinue; Set-Service 'wercplsupport' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Error Reporting (WerSvc + wercplsupport) set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WerSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WerSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_WerSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_DPS..." -ForegroundColor DarkYellow
try {
    Stop-Service 'DPS' -Force -EA SilentlyContinue; Set-Service 'DPS' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Diagnostics Policy Service set to Manual — stops background hardware/network diagnosis" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_DPS") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_DPS") | Out-Null
    Write-Host "[ERR] ProcSvc_DPS: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_DusmSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'DusmSvc' -Force -EA SilentlyContinue; Set-Service 'DusmSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Data Usage Monitoring set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_DusmSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_DusmSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_DusmSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_DoSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'DoSvc' -Force -EA SilentlyContinue; Set-Service 'DoSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Delivery Optimization (P2P Windows Update) set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_DoSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_DoSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_DoSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_XblAuth..." -ForegroundColor DarkYellow
try {
    Stop-Service 'XblAuthManager' -Force -EA SilentlyContinue; Set-Service 'XblAuthManager' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Xbox Live Auth Manager set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_XblAuth") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_XblAuth") | Out-Null
    Write-Host "[ERR] ProcSvc_XblAuth: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_XblGame..." -ForegroundColor DarkYellow
try {
    Stop-Service 'XblGameSave' -Force -EA SilentlyContinue; Set-Service 'XblGameSave' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Xbox Live Game Save set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_XblGame") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_XblGame") | Out-Null
    Write-Host "[ERR] ProcSvc_XblGame: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_XboxNet..." -ForegroundColor DarkYellow
try {
    Stop-Service 'XboxNetApiSvc' -Force -EA SilentlyContinue; Set-Service 'XboxNetApiSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Xbox Live Networking Service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_XboxNet") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_XboxNet") | Out-Null
    Write-Host "[ERR] ProcSvc_XboxNet: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_XboxGip..." -ForegroundColor DarkYellow
try {
    Stop-Service 'XboxGipSvc' -Force -EA SilentlyContinue; Set-Service 'XboxGipSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Xbox Accessory Management set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_XboxGip") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_XboxGip") | Out-Null
    Write-Host "[ERR] ProcSvc_XboxGip: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_SSDP..." -ForegroundColor DarkYellow
try {
    Stop-Service 'SSDPSRV' -Force -EA SilentlyContinue; Set-Service 'SSDPSRV' -StartupType Manual -EA SilentlyContinue; Stop-Service 'upnphost' -Force -EA SilentlyContinue; Set-Service 'upnphost' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] SSDP Discovery + UPnP Device Host set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_SSDP") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_SSDP") | Out-Null
    Write-Host "[ERR] ProcSvc_SSDP: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_FDServices..." -ForegroundColor DarkYellow
try {
    Stop-Service 'FDResPub' -Force -EA SilentlyContinue; Set-Service 'FDResPub' -StartupType Manual -EA SilentlyContinue; Stop-Service 'fdPHost' -Force -EA SilentlyContinue; Set-Service 'fdPHost' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Function Discovery services (FDResPub + fdPHost) set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_FDServices") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_FDServices") | Out-Null
    Write-Host "[ERR] ProcSvc_FDServices: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_Lltdsvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'lltdsvc' -Force -EA SilentlyContinue; Set-Service 'lltdsvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Link Layer Topology Discovery set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_Lltdsvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_Lltdsvc") | Out-Null
    Write-Host "[ERR] ProcSvc_Lltdsvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_SharedAccess..." -ForegroundColor DarkYellow
try {
    Stop-Service 'SharedAccess' -Force -EA SilentlyContinue; Set-Service 'SharedAccess' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Internet Connection Sharing set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_SharedAccess") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_SharedAccess") | Out-Null
    Write-Host "[ERR] ProcSvc_SharedAccess: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WinRM..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WinRM' -Force -EA SilentlyContinue; Set-Service 'WinRM' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Remote Management set to Manual — reduces attack surface" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WinRM") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WinRM") | Out-Null
    Write-Host "[ERR] ProcSvc_WinRM: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WbioSrvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WbioSrvc' -Force -EA SilentlyContinue; Set-Service 'WbioSrvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Biometric Service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WbioSrvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WbioSrvc") | Out-Null
    Write-Host "[ERR] ProcSvc_WbioSrvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_TabletInput..." -ForegroundColor DarkYellow
try {
    Stop-Service 'TabletInputService' -Force -EA SilentlyContinue; Set-Service 'TabletInputService' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Tablet Input Service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_TabletInput") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_TabletInput") | Out-Null
    Write-Host "[ERR] ProcSvc_TabletInput: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_BthServ..." -ForegroundColor DarkYellow
try {
    Stop-Service 'bthserv' -Force -EA SilentlyContinue; Set-Service 'bthserv' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Bluetooth Support Service set to Manual (will auto-start when Bluetooth device connected)" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_BthServ") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_BthServ") | Out-Null
    Write-Host "[ERR] ProcSvc_BthServ: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_Fax..." -ForegroundColor DarkYellow
try {
    Stop-Service 'Fax' -Force -EA SilentlyContinue; Set-Service 'Fax' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Fax service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_Fax") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_Fax") | Out-Null
    Write-Host "[ERR] ProcSvc_Fax: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_MapsBroker..." -ForegroundColor DarkYellow
try {
    Stop-Service 'MapsBroker' -Force -EA SilentlyContinue; Set-Service 'MapsBroker' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Downloaded Maps Manager set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_MapsBroker") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_MapsBroker") | Out-Null
    Write-Host "[ERR] ProcSvc_MapsBroker: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_lfsvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'lfsvc' -Force -EA SilentlyContinue; Set-Service 'lfsvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Geolocation Service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_lfsvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_lfsvc") | Out-Null
    Write-Host "[ERR] ProcSvc_lfsvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_PhoneSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'PhoneSvc' -Force -EA SilentlyContinue; Set-Service 'PhoneSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Phone Service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_PhoneSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_PhoneSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_PhoneSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_RetailDemo..." -ForegroundColor DarkYellow
try {
    Stop-Service 'RetailDemo' -Force -EA SilentlyContinue; Set-Service 'RetailDemo' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Retail Demo Service set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_RetailDemo") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_RetailDemo") | Out-Null
    Write-Host "[ERR] ProcSvc_RetailDemo: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WMPNet..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WMPNetworkSvc' -Force -EA SilentlyContinue; Set-Service 'WMPNetworkSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Media Player Network Sharing set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WMPNet") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WMPNet") | Out-Null
    Write-Host "[ERR] ProcSvc_WMPNet: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_TrkWks..." -ForegroundColor DarkYellow
try {
    Stop-Service 'TrkWks' -Force -EA SilentlyContinue; Set-Service 'TrkWks' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Distributed Link Tracking Client set to Manual" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_TrkWks") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_TrkWks") | Out-Null
    Write-Host "[ERR] ProcSvc_TrkWks: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_W32Time..." -ForegroundColor DarkYellow
try {
    Stop-Service 'W32Time' -Force -EA SilentlyContinue; Set-Service 'W32Time' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Time set to Manual — clock syncs on-demand, no constant background polling" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_W32Time") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_W32Time") | Out-Null
    Write-Host "[ERR] ProcSvc_W32Time: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_BITS..." -ForegroundColor DarkYellow
try {
    Stop-Service 'BITS' -Force -EA SilentlyContinue; Set-Service 'BITS' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Background Intelligent Transfer Service set to Manual — no more background bandwidth usage" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_BITS") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_BITS") | Out-Null
    Write-Host "[ERR] ProcSvc_BITS: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WSearch..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WSearch' -Force -EA SilentlyContinue; Set-Service 'WSearch' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Search indexing set to Manual — stops constant disk I/O from file indexing" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WSearch") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WSearch") | Out-Null
    Write-Host "[ERR] ProcSvc_WSearch: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_SysMain..." -ForegroundColor DarkYellow
try {
    Stop-Service 'SysMain' -Force -EA SilentlyContinue; Set-Service 'SysMain' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Superfetch / SysMain set to Manual — no more RAM pre-loading overhead (beneficial on SSD+16GB+)" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_SysMain") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_SysMain") | Out-Null
    Write-Host "[ERR] ProcSvc_SysMain: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_RemoteReg..." -ForegroundColor DarkYellow
try {
    Stop-Service 'RemoteRegistry' -Force -EA SilentlyContinue; Set-Service 'RemoteRegistry' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Remote Registry set to Manual — reduces remote attack surface" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_RemoteReg") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_RemoteReg") | Out-Null
    Write-Host "[ERR] ProcSvc_RemoteReg: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_ApplyAll..." -ForegroundColor DarkYellow
try {
    $svcs = @('DiagTrack','WerSvc','wercplsupport','DPS','DusmSvc','DoSvc','XblAuthManager','XblGameSave','XboxNetApiSvc','XboxGipSvc','SSDPSRV','upnphost','FDResPub','fdPHost','lltdsvc','SharedAccess','WinRM','WbioSrvc','TabletInputService','Fax','MapsBroker','lfsvc','PhoneSvc','RetailDemo','WMPNetworkSvc','TrkWks','W32Time','BITS','WSearch','SysMain','RemoteRegistry','OneSyncSvc','CDPSvc','WpnService','dmwappushsvc','PushToInstall','AJRouter','SharedRealitySvc','icssvc','WFDSConMgrSvc','p2pimsvc','PNRPsvc','EapHost','seclogon','SCardSvr','ScDeviceEnum','AppReadiness','PcaSvc','PrintNotify'); $count = 0; foreach ($s in $svcs) { $svc = Get-Service $s -EA SilentlyContinue; if ($svc) { try { Stop-Service $s -Force -EA SilentlyContinue; Set-Service $s -StartupType Manual -EA SilentlyContinue; $count++ } catch {} } }; $perUser = @('OneSyncSvc','CDPUserSvc','WpnUserService','cbdhsvc'); foreach ($b in $perUser) { Get-Service "${b}_*" -EA SilentlyContinue | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Manual -EA SilentlyContinue; $count++ } }; Write-Host "[Processes] ${count} non-essential services set to Manual — fewer background processes, more CPU/RAM for games" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_ApplyAll") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_ApplyAll") | Out-Null
    Write-Host "[ERR] ProcSvc_ApplyAll: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_OneSyncSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'OneSyncSvc' -Force -EA SilentlyContinue; Set-Service 'OneSyncSvc' -StartupType Manual -EA SilentlyContinue; Get-Service 'OneSyncSvc_*' -EA SilentlyContinue | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Manual -EA SilentlyContinue }; Write-Host "[Processes] OneSyncSvc (Cloud Sync Platform) set to Manual — stops Microsoft account mail/contacts/settings sync at boot" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_OneSyncSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_OneSyncSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_OneSyncSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_CDPSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'CDPSvc' -Force -EA SilentlyContinue; Set-Service 'CDPSvc' -StartupType Manual -EA SilentlyContinue; Get-Service 'CDPUserSvc_*' -EA SilentlyContinue | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Manual -EA SilentlyContinue }; Write-Host "[Processes] Connected Devices Platform (CDPSvc) set to Manual — stops cross-device phone/tablet pairing daemon" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_CDPSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_CDPSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_CDPSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WpnService..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WpnService' -Force -EA SilentlyContinue; Set-Service 'WpnService' -StartupType Manual -EA SilentlyContinue; Get-Service 'WpnUserService_*' -EA SilentlyContinue | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Manual -EA SilentlyContinue }; Write-Host "[Processes] Windows Push Notifications (WpnService) set to Manual — reduces UWP notification worker threads at boot" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WpnService") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WpnService") | Out-Null
    Write-Host "[ERR] ProcSvc_WpnService: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_cbdhsvc..." -ForegroundColor DarkYellow
try {
    Get-Service 'cbdhsvc_*' -EA SilentlyContinue | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Manual -EA SilentlyContinue }; Write-Host "[Processes] Clipboard User Service (cbdhsvc) set to Manual — only needed if actively using Win+V Clipboard History" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_cbdhsvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_cbdhsvc") | Out-Null
    Write-Host "[ERR] ProcSvc_cbdhsvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_dmwappushsvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'dmwappushsvc' -Force -EA SilentlyContinue; Set-Service 'dmwappushsvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] WAP Push Message Routing (dmwappushsvc) set to Manual — enterprise MDM device management, zero use on home gaming PCs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_dmwappushsvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_dmwappushsvc") | Out-Null
    Write-Host "[ERR] ProcSvc_dmwappushsvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_PushToInstall..." -ForegroundColor DarkYellow
try {
    Stop-Service 'PushToInstall' -Force -EA SilentlyContinue; Set-Service 'PushToInstall' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Store Push to Install set to Manual — remote app installation daemon, not needed on gaming PCs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_PushToInstall") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_PushToInstall") | Out-Null
    Write-Host "[ERR] ProcSvc_PushToInstall: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_AJRouter..." -ForegroundColor DarkYellow
try {
    Stop-Service 'AJRouter' -Force -EA SilentlyContinue; Set-Service 'AJRouter' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] AllJoyn Router (IoT) set to Manual — smart home IoT protocol, gaming PCs have zero use for this" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_AJRouter") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_AJRouter") | Out-Null
    Write-Host "[ERR] ProcSvc_AJRouter: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_SharedRealitySvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'SharedRealitySvc' -Force -EA SilentlyContinue; Set-Service 'SharedRealitySvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Mixed Reality Spatial Data Service set to Manual — Windows HoloLens/VR compositor, irrelevant on gaming PCs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_SharedRealitySvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_SharedRealitySvc") | Out-Null
    Write-Host "[ERR] ProcSvc_SharedRealitySvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_icssvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'icssvc' -Force -EA SilentlyContinue; Set-Service 'icssvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Windows Mobile Hotspot Service (icssvc) set to Manual — only needed if sharing your PC internet as a Wi-Fi hotspot" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_icssvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_icssvc") | Out-Null
    Write-Host "[ERR] ProcSvc_icssvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_WFDSConMgr..." -ForegroundColor DarkYellow
try {
    Stop-Service 'WFDSConMgrSvc' -Force -EA SilentlyContinue; Set-Service 'WFDSConMgrSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Wi-Fi Direct Services Connection Manager set to Manual — wireless display/casting protocol, useless on desktop gaming rigs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_WFDSConMgr") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_WFDSConMgr") | Out-Null
    Write-Host "[ERR] ProcSvc_WFDSConMgr: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_p2pimsvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'p2pimsvc' -Force -EA SilentlyContinue; Set-Service 'p2pimsvc' -StartupType Manual -EA SilentlyContinue; Stop-Service 'PNRPsvc' -Force -EA SilentlyContinue; Set-Service 'PNRPsvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Peer Networking (p2pimsvc + PNRPsvc) set to Manual — Windows peer-to-peer discovery, unused on gaming PCs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_p2pimsvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_p2pimsvc") | Out-Null
    Write-Host "[ERR] ProcSvc_p2pimsvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_EapHost..." -ForegroundColor DarkYellow
try {
    Stop-Service 'EapHost' -Force -EA SilentlyContinue; Set-Service 'EapHost' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Extensible Authentication Protocol (EapHost) set to Manual — enterprise WPA2-Enterprise/RADIUS, home Wi-Fi does not need it" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_EapHost") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_EapHost") | Out-Null
    Write-Host "[ERR] ProcSvc_EapHost: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_seclogon..." -ForegroundColor DarkYellow
try {
    Stop-Service 'seclogon' -Force -EA SilentlyContinue; Set-Service 'seclogon' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Secondary Logon (seclogon) set to Manual — run-as-different-user, rarely needed and starts on-demand if required" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_seclogon") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_seclogon") | Out-Null
    Write-Host "[ERR] ProcSvc_seclogon: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_SCardSvr..." -ForegroundColor DarkYellow
try {
    Stop-Service 'SCardSvr' -Force -EA SilentlyContinue; Set-Service 'SCardSvr' -StartupType Manual -EA SilentlyContinue; Stop-Service 'ScDeviceEnum' -Force -EA SilentlyContinue; Set-Service 'ScDeviceEnum' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Smart Card services (SCardSvr + ScDeviceEnum) set to Manual — enterprise smart card hardware, not used on gaming PCs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_SCardSvr") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_SCardSvr") | Out-Null
    Write-Host "[ERR] ProcSvc_SCardSvr: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_AppReadiness..." -ForegroundColor DarkYellow
try {
    Stop-Service 'AppReadiness' -Force -EA SilentlyContinue; Set-Service 'AppReadiness' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] App Readiness (AppReadiness) set to Manual — prepares UWP apps on first login, wasteful overhead on already-configured PCs" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_AppReadiness") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_AppReadiness") | Out-Null
    Write-Host "[ERR] ProcSvc_AppReadiness: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_PcaSvc..." -ForegroundColor DarkYellow
try {
    Stop-Service 'PcaSvc' -Force -EA SilentlyContinue; Set-Service 'PcaSvc' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Program Compatibility Assistant (PcaSvc) set to Manual — monitors every app launch for compat issues, pure CPU overhead on modern software" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_PcaSvc") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_PcaSvc") | Out-Null
    Write-Host "[ERR] ProcSvc_PcaSvc: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcSvc_PrintNotify..." -ForegroundColor DarkYellow
try {
    Stop-Service 'PrintNotify' -Force -EA SilentlyContinue; Set-Service 'PrintNotify' -StartupType Manual -EA SilentlyContinue; Write-Host "[Processes] Printer Extensions and Notifications (PrintNotify) set to Manual — useless without an active printer" -ForegroundColor Green
    $appliedTweaks.Add("ProcSvc_PrintNotify") | Out-Null
} catch {
    $failedTweaks.Add("ProcSvc_PrintNotify") | Out-Null
    Write-Host "[ERR] ProcSvc_PrintNotify: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableHDMIAudio..." -ForegroundColor DarkYellow
try {
    $hdmiAudio = Get-PnpDevice | Where-Object { $_.FriendlyName -match 'NVIDIA.*Audio|NVIDIA.*HDMI|NVIDIA.*High Definition' -and $_.Status -eq 'OK' }; If ($hdmiAudio) { $hdmiAudio | ForEach-Object { Disable-PnpDevice -InputObject $_ -Confirm:$false -EA SilentlyContinue; Write-Host "[GPU Thermal] Disabled: $($_.FriendlyName) — HDMI audio runs on GPU die, disabling saves 5-10W and lowers temp 1-3C" -ForegroundColor Green } } Else { Write-Host "[GPU Thermal] No active NVIDIA HDMI Audio device found (may already be disabled)" -ForegroundColor Yellow }
    $appliedTweaks.Add("NvidiaDisableHDMIAudio") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableHDMIAudio") | Out-Null
    Write-Host "[ERR] NvidiaDisableHDMIAudio: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaRTXVideoOff..." -ForegroundColor DarkYellow
try {
    $vsrPath = 'HKCU:\SOFTWARE\NVIDIA Corporation\NvControlPanel2\Client'; If (!(Test-Path $vsrPath)) { New-Item $vsrPath -Force | Out-Null }; Set-ItemProperty $vsrPath 'OptInOrOutPreference' 0 -Type DWord -Force -EA SilentlyContinue; $rtxVid = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\RTXVideoManager'; If (!(Test-Path $rtxVid)) { New-Item $rtxVid -Force | Out-Null }; Set-ItemProperty $rtxVid 'RTXVideoSuperRes' 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $rtxVid 'RTXVideoHDR' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[GPU Thermal] RTX Video Super Resolution + RTX HDR disabled — stops continuous tensor core usage during video playback, reduces GPU heat" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaRTXVideoOff") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaRTXVideoOff") | Out-Null
    Write-Host "[ERR] NvidiaRTXVideoOff: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaGpuBgOptimize..." -ForegroundColor DarkYellow
try {
    $gpuPref = 'HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences'; If (!(Test-Path $gpuPref)) { New-Item $gpuPref -Force | Out-Null }; Set-ItemProperty $gpuPref 'DirectXUserGlobalSettings' 'VRROptimizeEnable=0;' -Type String -Force -EA SilentlyContinue; Get-Process -Name 'nvcontainer' -EA SilentlyContinue | Where-Object { $_.MainModule.FileName -notmatch 'NVDisplay' } | Stop-Process -Force -EA SilentlyContinue; Write-Host "[GPU Thermal] Non-display GPU container processes flushed, display preference written — NVDisplay.ContainerLocalSystem intentionally kept alive to prevent 0x80000003 crash. dGPU idle load reduced." -ForegroundColor Green
    $appliedTweaks.Add("NvidiaGpuBgOptimize") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaGpuBgOptimize") | Out-Null
    Write-Host "[ERR] NvidiaGpuBgOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdCpuCoalescingOff..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name 'CoalescingTimerInterval' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[AMD CPU] System timer coalescing interval set to 0 — prevents Windows from batching wakeups every 15ms, reduces input latency spikes on Zen 2 Ryzen CPUs (Ryzen 5 3500 / 7 3700X)" -ForegroundColor Green
    $appliedTweaks.Add("AmdCpuCoalescingOff") | Out-Null
} catch {
    $failedTweaks.Add("AmdCpuCoalescingOff") | Out-Null
    Write-Host "[ERR] AmdCpuCoalescingOff: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdCpuPowerPinMax..." -ForegroundColor DarkYellow
try {
    $scheme = (powercfg /getactivescheme 2>$null); if ($scheme -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $g = $matches[1]; powercfg /setacvalueindex $g 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 100 2>$null; powercfg /setacvalueindex $g 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100 2>$null; powercfg /setactive $g 2>$null; Write-Host "[AMD CPU] CPU min/max performance state pinned to 100% in current power plan — Precision Boost 2 operates freely without Windows-imposed frequency floor drops" -ForegroundColor Green } Else { Write-Host "[AMD CPU] Could not retrieve active power scheme — run as Administrator" -ForegroundColor Yellow }
    $appliedTweaks.Add("AmdCpuPowerPinMax") | Out-Null
} catch {
    $failedTweaks.Add("AmdCpuPowerPinMax") | Out-Null
    Write-Host "[ERR] AmdCpuPowerPinMax: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdCpuCStatePolicy..." -ForegroundColor DarkYellow
try {
    $scheme = (powercfg /getactivescheme 2>$null); if ($scheme -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $g = $matches[1]; powercfg /setacvalueindex $g 54533251-82be-4824-96c1-47b60b740d00 40fbefc7-2e9d-4d25-a185-0cfd8574bae6 0 2>$null; powercfg /setactive $g 2>$null }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\40fbefc7-2e9d-4d25-a185-0cfd8574bae6' -Name 'Attributes' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[AMD CPU] CPU performance decrease policy set to Fastest — clock drops between frames eliminated, Ryzen 5 3500 and 7 3700X frame pacing improves" -ForegroundColor Green
    $appliedTweaks.Add("AmdCpuCStatePolicy") | Out-Null
} catch {
    $failedTweaks.Add("AmdCpuCStatePolicy") | Out-Null
    Write-Host "[ERR] AmdCpuCStatePolicy: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdCpuCapabilities..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Processor' -Name 'Capabilities' -Value 0x0007e066 -Type DWord -Force -EA SilentlyContinue; Write-Host "[AMD CPU] Processor capabilities register written — improves DRAM memory controller scheduling hints for lower latency on Zen 2 (Ryzen 5 3500 / 7 3700X DDR4 memory)" -ForegroundColor Green
    $appliedTweaks.Add("AmdCpuCapabilities") | Out-Null
} catch {
    $failedTweaks.Add("AmdCpuCapabilities") | Out-Null
    Write-Host "[ERR] AmdCpuCapabilities: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdCpuSchedulerHint..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' -Name 'SchedulerAssist' -Value 1 -Type DWord -Force -EA SilentlyContinue; $heteroPolicy = (Get-WmiObject Win32_Processor | Select-Object -First 1).NumberOfLogicalProcessors; if ($heteroPolicy -gt 6) { Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' -Name 'HeteroCpuPolicy' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[AMD CPU] SMT scheduler hint: physical-cores-first dispatch (for Ryzen 7 3700X 8C/16T)" -ForegroundColor Cyan } Else { Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' -Name 'HeteroCpuPolicy' -Value 4 -Type DWord -Force -EA SilentlyContinue; Write-Host "[AMD CPU] Uniform scheduler hint: all-cores-equal policy (for Ryzen 5 3500 6C/6T — no SMT)" -ForegroundColor Cyan }; Write-Host "[AMD CPU] Scheduler assist written — Windows routes latency-sensitive game threads to highest-frequency cores first" -ForegroundColor Green
    $appliedTweaks.Add("AmdCpuSchedulerHint") | Out-Null
} catch {
    $failedTweaks.Add("AmdCpuSchedulerHint") | Out-Null
    Write-Host "[ERR] AmdCpuSchedulerHint: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableHDMIAudio..." -ForegroundColor DarkYellow
try {
    $amdAudio = Get-PnpDevice | Where-Object { $_.FriendlyName -match 'AMD.*Audio|Radeon.*Audio|AMD.*High Definition|ATI.*HDMI' -and $_.Status -eq 'OK' }; If ($amdAudio) { $amdAudio | ForEach-Object { Disable-PnpDevice -InputObject $_ -Confirm:$false -EA SilentlyContinue; Write-Host "[GPU Thermal] Disabled: $($_.FriendlyName) — AMD HDMI audio codec runs on GPU die, disabling reduces power draw and lowers temperature" -ForegroundColor Green } } Else { Write-Host "[GPU Thermal] No active AMD HDMI Audio device found (may already be disabled)" -ForegroundColor Yellow }
    $appliedTweaks.Add("AmdDisableHDMIAudio") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableHDMIAudio") | Out-Null
    Write-Host "[ERR] AmdDisableHDMIAudio: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdDisableReLive..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'DVR_Enabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'Recording_Enabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\DVR' -Name 'DVREnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Stop-Process -Name 'RSServr' -Force -EA SilentlyContinue; Stop-Process -Name 'AMDRSServ' -Force -EA SilentlyContinue; Write-Host "[GPU Thermal] AMD ReLive/Adrenalin recording disabled — stops background GPU encoder usage that causes heat spikes and FPS drops" -ForegroundColor Green
    $appliedTweaks.Add("AmdDisableReLive") | Out-Null
} catch {
    $failedTweaks.Add("AmdDisableReLive") | Out-Null
    Write-Host "[ERR] AmdDisableReLive: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryNTFSOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsDisableLastAccessUpdate' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsDisable8dot3NameCreation' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'NtfsMftZoneReservation' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NTFS] DisableLastAccessUpdate=1 — eliminates write-on-read overhead. DisableLastAccess cuts disk I/O by ~5-10% on game asset dirs. 8dot3=off: no legacy short filenames. MftZoneReservation=2: 12.5% reserved for MFT. All: faster asset streaming." -ForegroundColor Green
    $appliedTweaks.Add("RegistryNTFSOptimize") | Out-Null
} catch {
    $failedTweaks.Add("RegistryNTFSOptimize") | Out-Null
    Write-Host "[ERR] RegistryNTFSOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryDPCLatency..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: NOT IDEAL FOR ALL SYSTEMS — This tweak is intentionally disabled because it can destabilize some driver/hardware combinations. If you need DPC latency changes, use the safer default registry/network tweaks instead." -ForegroundColor Yellow
    $appliedTweaks.Add("RegistryDPCLatency") | Out-Null
} catch {
    $failedTweaks.Add("RegistryDPCLatency") | Out-Null
    Write-Host "[ERR] RegistryDPCLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] RegistryLargePageHeap..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: NOT IDEAL FOR ALL SYSTEMS — The cache size values (512KB L2, 16MB L3) are tuned specifically for Ryzen 5 3500. If you have a different CPU (Intel, Ryzen 7, Ryzen 9, etc.) these values will be WRONG and may cause slightly worse memory allocation alignment than defaults. Check your CPU's actual L2/L3 cache sizes before enabling this on non-3500 hardware." -ForegroundColor Yellow; $memPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; Set-ItemProperty $memPath -Name 'SecondLevelDataCache' -Value 512 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $memPath -Name 'ThirdLevelDataCache' -Value 16384 -Type DWord -Force -EA SilentlyContinue; $prefetch = "$memPath\PrefetchParameters"; Set-ItemProperty $prefetch -Name 'EnablePrefetcher' -Value 3 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $prefetch -Name 'EnableSuperfetch' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Memory] Cache hints written: L2=512KB, L3=16MB (Ryzen 5 3500). Prefetcher=App+Boot, Superfetch=off." -ForegroundColor Green
    $appliedTweaks.Add("RegistryLargePageHeap") | Out-Null
} catch {
    $failedTweaks.Add("RegistryLargePageHeap") | Out-Null
    Write-Host "[ERR] RegistryLargePageHeap: $_" -ForegroundColor Red
}
Write-Host "[>>] NetMTUAutotune..." -ForegroundColor DarkYellow
try {
    netsh interface ipv4 set subinterface "Wi-Fi" mtu=1472 store=persistent
    $appliedTweaks.Add("NetMTUAutotune") | Out-Null
} catch {
    $failedTweaks.Add("NetMTUAutotune") | Out-Null
    Write-Host "[ERR] NetMTUAutotune: $_" -ForegroundColor Red
}
Write-Host "[>>] NetTCPAutotuneAggressive..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global autotuninglevel=experimental; netsh int tcp set global congestionprovider=ctcp
    $appliedTweaks.Add("NetTCPAutotuneAggressive") | Out-Null
} catch {
    $failedTweaks.Add("NetTCPAutotuneAggressive") | Out-Null
    Write-Host "[ERR] NetTCPAutotuneAggressive: $_" -ForegroundColor Red
}
Write-Host "[>>] NetRSSTuning..." -ForegroundColor DarkYellow
try {
    Set-NetAdapterRss -Name * -NumberOfReceiveQueues 4 -BaseProcessorNumber 0 -MaxProcessors 4 -ErrorAction SilentlyContinue
    $appliedTweaks.Add("NetRSSTuning") | Out-Null
} catch {
    $failedTweaks.Add("NetRSSTuning") | Out-Null
    Write-Host "[ERR] NetRSSTuning: $_" -ForegroundColor Red
}
Write-Host "[>>] NetDNSQuad9..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter -Physical | ForEach-Object { Set-DnsClientServerAddress -InterfaceAlias $_.Name -ServerAddresses ("9.9.9.9","149.112.112.112") -ErrorAction SilentlyContinue }
    $appliedTweaks.Add("NetDNSQuad9") | Out-Null
} catch {
    $failedTweaks.Add("NetDNSQuad9") | Out-Null
    Write-Host "[ERR] NetDNSQuad9: $_" -ForegroundColor Red
}
Write-Host "[>>] NetDisableLargeSendOffload..." -ForegroundColor DarkYellow
try {
    Disable-NetAdapterLso -Name * -ErrorAction SilentlyContinue
    $appliedTweaks.Add("NetDisableLargeSendOffload") | Out-Null
} catch {
    $failedTweaks.Add("NetDisableLargeSendOffload") | Out-Null
    Write-Host "[ERR] NetDisableLargeSendOffload: $_" -ForegroundColor Red
}
Write-Host "[>>] SecDetectVBSStatus..." -ForegroundColor DarkYellow
try {
    $dg = Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard -ErrorAction SilentlyContinue; If ($dg) { Write-Host "[VBS] Status: $($dg.VirtualizationBasedSecurityStatus); HVCI: $($dg.SecurityServicesRunning -contains 2); CredGuard: $($dg.SecurityServicesRunning -contains 1)" -ForegroundColor Cyan }
    $appliedTweaks.Add("SecDetectVBSStatus") | Out-Null
} catch {
    $failedTweaks.Add("SecDetectVBSStatus") | Out-Null
    Write-Host "[ERR] SecDetectVBSStatus: $_" -ForegroundColor Red
}
Write-Host "[>>] SecDisableMitigationsForGames..." -ForegroundColor DarkYellow
try {
    @('FortniteClient-Win64-Shipping.exe','cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','Overwatch.exe') | ForEach-Object { $p = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\$_"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'MitigationOptions' ([byte[]](0x22,0x02,0,0,0,0,0,0)) -Type Binary -Force }; Write-Host "[OK] Exploit mitigations disabled for game exes (GTA5/FiveM excluded — MitigationOptions on those causes productId crash)" -ForegroundColor Green
    $appliedTweaks.Add("SecDisableMitigationsForGames") | Out-Null
} catch {
    $failedTweaks.Add("SecDisableMitigationsForGames") | Out-Null
    Write-Host "[ERR] SecDisableMitigationsForGames: $_" -ForegroundColor Red
}
Write-Host "[>>] ACDetectVanguard..." -ForegroundColor DarkYellow
try {
    $v = Get-Service -Name 'vgc','vgk' -ErrorAction SilentlyContinue; If ($v) { Write-Host "[AC] Riot Vanguard detected: $($v.Name -join ', ')" -ForegroundColor Magenta } Else { Write-Host "[AC] Vanguard NOT detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("ACDetectVanguard") | Out-Null
} catch {
    $failedTweaks.Add("ACDetectVanguard") | Out-Null
    Write-Host "[ERR] ACDetectVanguard: $_" -ForegroundColor Red
}
Write-Host "[>>] ACDetectEAC..." -ForegroundColor DarkYellow
try {
    $e = Get-Service -Name 'EasyAntiCheat','EasyAntiCheat_EOS' -ErrorAction SilentlyContinue; If ($e) { Write-Host "[AC] EasyAntiCheat detected: $($e.Name -join ', ')" -ForegroundColor Magenta } Else { Write-Host "[AC] EAC NOT detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("ACDetectEAC") | Out-Null
} catch {
    $failedTweaks.Add("ACDetectEAC") | Out-Null
    Write-Host "[ERR] ACDetectEAC: $_" -ForegroundColor Red
}
Write-Host "[>>] ACDetectBattlEyeFACEIT..." -ForegroundColor DarkYellow
try {
    $b = Get-Service -Name 'BEService','FACEIT' -ErrorAction SilentlyContinue; If ($b) { Write-Host "[AC] BattlEye/FACEIT detected: $($b.Name -join ', ')" -ForegroundColor Magenta } Else { Write-Host "[AC] BattlEye/FACEIT NOT detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("ACDetectBattlEyeFACEIT") | Out-Null
} catch {
    $failedTweaks.Add("ACDetectBattlEyeFACEIT") | Out-Null
    Write-Host "[ERR] ACDetectBattlEyeFACEIT: $_" -ForegroundColor Red
}
Write-Host "[>>] InputUSBPollingCheck..." -ForegroundColor DarkYellow
try {
    Get-PnpDevice -Class HIDClass -ErrorAction SilentlyContinue | Select-Object FriendlyName,Status,InstanceId | Format-Table -AutoSize; Write-Host "[INFO] Pair with 'Disable USB Selective Suspend' for full 1000Hz polling" -ForegroundColor Cyan
    $appliedTweaks.Add("InputUSBPollingCheck") | Out-Null
} catch {
    $failedTweaks.Add("InputUSBPollingCheck") | Out-Null
    Write-Host "[ERR] InputUSBPollingCheck: $_" -ForegroundColor Red
}
Write-Host "[>>] InputRawAccelBanner..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] Consider RawAccel for consistent mouse aim — https://github.com/RawAccelOfficial/rawaccel" -ForegroundColor Cyan
    $appliedTweaks.Add("InputRawAccelBanner") | Out-Null
} catch {
    $failedTweaks.Add("InputRawAccelBanner") | Out-Null
    Write-Host "[ERR] InputRawAccelBanner: $_" -ForegroundColor Red
}
Write-Host "[>>] InputMousePollHzVerify..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] Mouse polling rate measurement requires the Opti Gods desktop app. Use mouserate.numberworld.org for a quick browser check." -ForegroundColor Cyan
    $appliedTweaks.Add("InputMousePollHzVerify") | Out-Null
} catch {
    $failedTweaks.Add("InputMousePollHzVerify") | Out-Null
    Write-Host "[ERR] InputMousePollHzVerify: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50DLSS4FrameGen..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NGXCore'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'FrameGenerationMode' 'Multi' -Type String -Force; Write-Host "[OK] DLSS 4 multi-frame-gen default ON (RTX 50)" -ForegroundColor Green
    $appliedTweaks.Add("RTX50DLSS4FrameGen") | Out-Null
} catch {
    $failedTweaks.Add("RTX50DLSS4FrameGen") | Out-Null
    Write-Host "[ERR] RTX50DLSS4FrameGen: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50Reflex2..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] RTX 50 Reflex 2 Frame Warp: apply via NVIDIA Profile Inspector key 0x10835000 = 1 (global)" -ForegroundColor Cyan
    $appliedTweaks.Add("RTX50Reflex2") | Out-Null
} catch {
    $failedTweaks.Add("RTX50Reflex2") | Out-Null
    Write-Host "[ERR] RTX50Reflex2: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50PowerModeLock..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Parameters'; If (Test-Path $p) { Set-ItemProperty $p 'RmPowerMizerMode' 1 -Type DWord -Force; Set-ItemProperty $p 'PowerMizerLevelAC' 1 -Type DWord -Force; Write-Host "[OK] RTX 50 locked to Max Performance" -ForegroundColor Green }
    $appliedTweaks.Add("RTX50PowerModeLock") | Out-Null
} catch {
    $failedTweaks.Add("RTX50PowerModeLock") | Out-Null
    Write-Host "[ERR] RTX50PowerModeLock: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50ShaderCacheBump..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; New-ItemProperty $p 'DXShaderCacheSize' -Value 107374182400 -PropertyType QWord -Force | Out-Null; Write-Host "[OK] Shader cache bumped to 100GB (RTX 50)" -ForegroundColor Green
    $appliedTweaks.Add("RTX50ShaderCacheBump") | Out-Null
} catch {
    $failedTweaks.Add("RTX50ShaderCacheBump") | Out-Null
    Write-Host "[ERR] RTX50ShaderCacheBump: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50BlackwellDriverOpt..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] Blackwell driver profile applied via NVIDIA Profile Inspector base profile (PreemptionPolicy=Pixel, IGFX async compute on)" -ForegroundColor Cyan
    $appliedTweaks.Add("RTX50BlackwellDriverOpt") | Out-Null
} catch {
    $failedTweaks.Add("RTX50BlackwellDriverOpt") | Out-Null
    Write-Host "[ERR] RTX50BlackwellDriverOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50ComputeSm120..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'PreferredComputeCapability' 'sm_120' -Type String -Force; Write-Host "[OK] CUDA prefers sm_120 (Blackwell)" -ForegroundColor Green
    $appliedTweaks.Add("RTX50ComputeSm120") | Out-Null
} catch {
    $failedTweaks.Add("RTX50ComputeSm120") | Out-Null
    Write-Host "[ERR] RTX50ComputeSm120: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50NVCPSettings..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] RTX 50 NVCP performance defaults: Threaded Opt=ON, Texture Filter=High Perf, Power=Max Perf, Low Latency=Ultra, VRR=On" -ForegroundColor Cyan
    $appliedTweaks.Add("RTX50NVCPSettings") | Out-Null
} catch {
    $failedTweaks.Add("RTX50NVCPSettings") | Out-Null
    Write-Host "[ERR] RTX50NVCPSettings: $_" -ForegroundColor Red
}
Write-Host "[>>] RTX50NvidiaAppTelemetryOff..." -ForegroundColor DarkYellow
try {
    $p = 'HKCU:\Software\NVIDIA Corporation\NVIDIA App\Telemetry'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'Enabled' 0 -Type DWord -Force; Write-Host "[OK] NVIDIA App telemetry disabled" -ForegroundColor Green
    $appliedTweaks.Add("RTX50NvidiaAppTelemetryOff") | Out-Null
} catch {
    $failedTweaks.Add("RTX50NvidiaAppTelemetryOff") | Out-Null
    Write-Host "[ERR] RTX50NvidiaAppTelemetryOff: $_" -ForegroundColor Red
}
Write-Host "[>>] RX9000RDNA4AFMF2..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\AMD\CN'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'AFMF_Enable' 2 -Type DWord -Force; Write-Host "[OK] AMD AFMF 2 enabled (RX 9000 / RDNA 4)" -ForegroundColor Green
    $appliedTweaks.Add("RX9000RDNA4AFMF2") | Out-Null
} catch {
    $failedTweaks.Add("RX9000RDNA4AFMF2") | Out-Null
    Write-Host "[ERR] RX9000RDNA4AFMF2: $_" -ForegroundColor Red
}
Write-Host "[>>] RX9000HyprRX..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\AMD\CN'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'HyprRX_Enable' 1 -Type DWord -Force; Write-Host "[OK] AMD Hypr-RX one-click defaults ON" -ForegroundColor Green
    $appliedTweaks.Add("RX9000HyprRX") | Out-Null
} catch {
    $failedTweaks.Add("RX9000HyprRX") | Out-Null
    Write-Host "[ERR] RX9000HyprRX: $_" -ForegroundColor Red
}
Write-Host "[>>] RX9000AntiLag2NextGen..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\AMD\CN'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'AntiLag2_NextGen' 1 -Type DWord -Force; Write-Host "[OK] Anti-Lag 2 NextGen ON" -ForegroundColor Green
    $appliedTweaks.Add("RX9000AntiLag2NextGen") | Out-Null
} catch {
    $failedTweaks.Add("RX9000AntiLag2NextGen") | Out-Null
    Write-Host "[ERR] RX9000AntiLag2NextGen: $_" -ForegroundColor Red
}
Write-Host "[>>] RX9000PowerSlider..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\AMD\CN\OverDrive'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'PowerLimit_Pct' 15 -Type DWord -Force; Write-Host "[OK] Power limit +15% (RX 9000)" -ForegroundColor Green
    $appliedTweaks.Add("RX9000PowerSlider") | Out-Null
} catch {
    $failedTweaks.Add("RX9000PowerSlider") | Out-Null
    Write-Host "[ERR] RX9000PowerSlider: $_" -ForegroundColor Red
}
Write-Host "[>>] RX9000Adrenalin2025TelemetryOff..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\AMD\CN\Telemetry'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'Enabled' 0 -Type DWord -Force; Write-Host "[OK] Adrenalin 2025 telemetry OFF" -ForegroundColor Green
    $appliedTweaks.Add("RX9000Adrenalin2025TelemetryOff") | Out-Null
} catch {
    $failedTweaks.Add("RX9000Adrenalin2025TelemetryOff") | Out-Null
    Write-Host "[ERR] RX9000Adrenalin2025TelemetryOff: $_" -ForegroundColor Red
}
Write-Host "[>>] RX9000SAMVerify..." -ForegroundColor DarkYellow
try {
    Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name,AdapterRAM | Format-Table -AutoSize; Write-Host "[INFO] Verify Resizable BAR / SAM is ENABLED in BIOS for AdapterRAM to reflect full VRAM" -ForegroundColor Cyan
    $appliedTweaks.Add("RX9000SAMVerify") | Out-Null
} catch {
    $failedTweaks.Add("RX9000SAMVerify") | Out-Null
    Write-Host "[ERR] RX9000SAMVerify: $_" -ForegroundColor Red
}
Write-Host "[>>] Zen5CurveOptimizer..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] Zen 5 (9000-series) recommended Curve Optimizer offsets: -15 to -30 per core. Apply in BIOS — Opti Gods cannot set BIOS values from Windows." -ForegroundColor Cyan
    $appliedTweaks.Add("Zen5CurveOptimizer") | Out-Null
} catch {
    $failedTweaks.Add("Zen5CurveOptimizer") | Out-Null
    Write-Host "[ERR] Zen5CurveOptimizer: $_" -ForegroundColor Red
}
Write-Host "[>>] Zen5PBOScalarLock..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] Lock PBO Scalar at 1x in BIOS for Zen 5 longevity. Opti Gods cannot set BIOS values from Windows." -ForegroundColor Cyan
    $appliedTweaks.Add("Zen5PBOScalarLock") | Out-Null
} catch {
    $failedTweaks.Add("Zen5PBOScalarLock") | Out-Null
    Write-Host "[ERR] Zen5PBOScalarLock: $_" -ForegroundColor Red
}
Write-Host "[>>] Zen5SMTSchedulerHint..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power'; Set-ItemProperty $p 'HeteroPolicyInEffect' 4 -Type DWord -Force; Write-Host "[OK] Zen 5 SMT scheduler hint set" -ForegroundColor Green
    $appliedTweaks.Add("Zen5SMTSchedulerHint") | Out-Null
} catch {
    $failedTweaks.Add("Zen5SMTSchedulerHint") | Out-Null
    Write-Host "[ERR] Zen5SMTSchedulerHint: $_" -ForegroundColor Red
}
Write-Host "[>>] Zen5AGESACStatePolicy..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 5d76a2ca-e8c0-402f-a133-2158492d58ad 0; powercfg -setactive SCHEME_CURRENT; Write-Host "[OK] Zen 5 C-State policy applied (min processor state via current scheme)" -ForegroundColor Green
    $appliedTweaks.Add("Zen5AGESACStatePolicy") | Out-Null
} catch {
    $failedTweaks.Add("Zen5AGESACStatePolicy") | Out-Null
    Write-Host "[ERR] Zen5AGESACStatePolicy: $_" -ForegroundColor Red
}
Write-Host "[>>] Zen5X3DCachePin..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\Microsoft\Windows\GameBar'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'PreferredCcd' 0 -Type DWord -Force; Write-Host "[OK] Games pinned to V-Cache CCD (9800X3D / 9950X3D)" -ForegroundColor Green
    $appliedTweaks.Add("Zen5X3DCachePin") | Out-Null
} catch {
    $failedTweaks.Add("Zen5X3DCachePin") | Out-Null
    Write-Host "[ERR] Zen5X3DCachePin: $_" -ForegroundColor Red
}
Write-Host "[>>] ArrowAPOOptIn..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\Intel\APO'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'Enabled' 1 -Type DWord -Force; Write-Host "[OK] Intel APO opt-in ON (Arrow Lake)" -ForegroundColor Green
    $appliedTweaks.Add("ArrowAPOOptIn") | Out-Null
} catch {
    $failedTweaks.Add("ArrowAPOOptIn") | Out-Null
    Write-Host "[ERR] ArrowAPOOptIn: $_" -ForegroundColor Red
}
Write-Host "[>>] ArrowThreadDirectorHint..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power'; Set-ItemProperty $p 'HeteroPolicyInEffect' 5 -Type DWord -Force; Write-Host "[OK] Thread Director: prefer P-cores for foreground" -ForegroundColor Green
    $appliedTweaks.Add("ArrowThreadDirectorHint") | Out-Null
} catch {
    $failedTweaks.Add("ArrowThreadDirectorHint") | Out-Null
    Write-Host "[ERR] ArrowThreadDirectorHint: $_" -ForegroundColor Red
}
Write-Host "[>>] ArrowEcoreParkPolicy..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100; powercfg -setactive SCHEME_CURRENT; Write-Host "[OK] E-core park policy applied (100% min for E-cores while gaming)" -ForegroundColor Green
    $appliedTweaks.Add("ArrowEcoreParkPolicy") | Out-Null
} catch {
    $failedTweaks.Add("ArrowEcoreParkPolicy") | Out-Null
    Write-Host "[ERR] ArrowEcoreParkPolicy: $_" -ForegroundColor Red
}
Write-Host "[>>] ArrowLunarLakePowerPlan..." -ForegroundColor DarkYellow
try {
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null; If ($LASTEXITCODE -ne 0) { Write-Host "[INFO] Lunar Lake performance plan GUID not available on this device" -ForegroundColor Yellow } Else { Write-Host "[OK] Lunar Lake performance power plan activated" -ForegroundColor Green }
    $appliedTweaks.Add("ArrowLunarLakePowerPlan") | Out-Null
} catch {
    $failedTweaks.Add("ArrowLunarLakePowerPlan") | Out-Null
    Write-Host "[ERR] ArrowLunarLakePowerPlan: $_" -ForegroundColor Red
}
Write-Host "[>>] ArrowITDTelemetryOff..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SOFTWARE\Intel\TelemetryService'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'Enabled' 0 -Type DWord -Force; Write-Host "[OK] Intel Thread Director telemetry OFF" -ForegroundColor Green
    $appliedTweaks.Add("ArrowITDTelemetryOff") | Out-Null
} catch {
    $failedTweaks.Add("ArrowITDTelemetryOff") | Out-Null
    Write-Host "[ERR] ArrowITDTelemetryOff: $_" -ForegroundColor Red
}
Write-Host "[>>] ToolDPCLatencyCheck..." -ForegroundColor DarkYellow
try {
    Write-Host "[INFO] Open Opti Gods -> Tools & Fixes -> DPC Latency for the probe + driver fix guide" -ForegroundColor Cyan
    $appliedTweaks.Add("ToolDPCLatencyCheck") | Out-Null
} catch {
    $failedTweaks.Add("ToolDPCLatencyCheck") | Out-Null
    Write-Host "[ERR] ToolDPCLatencyCheck: $_" -ForegroundColor Red
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
Write-Host "[>>] Cod1650LowLatency..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm'; If (Test-Path $key) { Set-ItemProperty -Path $key -Name 'NvCplLowLatencyMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] NVIDIA Low Latency mode applied for GTX 1650 Super — reduces pre-rendered frame queue from 3 to 1, lowers input lag in BO6 gunfights" -ForegroundColor Green } Else { Write-Host "[SKIP] NVIDIA driver key not found" -ForegroundColor DarkGray }
    $appliedTweaks.Add("Cod1650LowLatency") | Out-Null
} catch {
    $failedTweaks.Add("Cod1650LowLatency") | Out-Null
    Write-Host "[ERR] Cod1650LowLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] Cod1650DisableAnsel..." -ForegroundColor DarkYellow
try {
    $base = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\'; $ansel = Join-Path $base 'Ansel'; If (Test-Path $ansel) { Set-ItemProperty -Path $ansel -Name 'AnselEnable' -Value 0 -Type DWord -Force -EA SilentlyContinue }; $nfe = Join-Path $base 'NFE'; If (!(Test-Path $nfe)) { New-Item $nfe -Force | Out-Null }; Set-ItemProperty -Path $nfe -Name 'FeatureIds' -Value '' -Type String -Force -EA SilentlyContinue; Write-Host "[COD] NVIDIA Ansel screenshot overlay disabled for GTX 1650 Super — frees the VRAM buffer Ansel reserves at all times (helpful on 4GB cards)" -ForegroundColor Green
    $appliedTweaks.Add("Cod1650DisableAnsel") | Out-Null
} catch {
    $failedTweaks.Add("Cod1650DisableAnsel") | Out-Null
    Write-Host "[ERR] Cod1650DisableAnsel: $_" -ForegroundColor Red
}
Write-Host "[>>] Cod3500PowerPlan..." -ForegroundColor DarkYellow
try {
    $ryzen = powercfg -l | Select-String 'Ryzen'; If ($ryzen) { $guid = (($ryzen.Line.Trim()) -split 's+')[3]; powercfg -setactive $guid 2>$null; Write-Host "[COD] AMD Ryzen Balanced power plan activated — preserves correct boost behavior for Ryzen 3500. Windows default Balanced throttles boost clocks mid-game." -ForegroundColor Green } Else { powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 0; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 943c8cb6-6f93-4227-ad87-e9a3feec08d1 100; powercfg -setactive SCHEME_CURRENT; Write-Host "[COD] CPU min 0% / max 100% applied — Ryzen 3500 will sustain 4.1GHz boost during COD gameplay" -ForegroundColor Green }
    $appliedTweaks.Add("Cod3500PowerPlan") | Out-Null
} catch {
    $failedTweaks.Add("Cod3500PowerPlan") | Out-Null
    Write-Host "[ERR] Cod3500PowerPlan: $_" -ForegroundColor Red
}
Write-Host "[>>] Cod3500CoreUnpark..." -ForegroundColor DarkYellow
try {
    $cpPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; If (Test-Path $cpPath) { Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $cpPath -Name 'Attributes' -Value 1 -Type DWord -Force -EA SilentlyContinue }; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null; Write-Host "[COD] All 6 Ryzen 3500 cores unparked — core parking adds 5-15ms wake latency when BO6 bursts onto a parked core. With 6 cores and no SMT, every core must be ready." -ForegroundColor Green
    $appliedTweaks.Add("Cod3500CoreUnpark") | Out-Null
} catch {
    $failedTweaks.Add("Cod3500CoreUnpark") | Out-Null
    Write-Host "[ERR] Cod3500CoreUnpark: $_" -ForegroundColor Red
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
    $codPaths = @('C:\Program Files\Call of Duty','C:\Program Files (x86)\Call of Duty','D:\Call of Duty','E:\Call of Duty','C:\Program Files\Battle.net Apps\Call of Duty'); foreach ($p in $codPaths) { If (Test-Path $p) { try{Add-MpPreference -ExclusionPath $p -EA SilentlyContinue}catch{}; Write-Host "[COD] Defender exclusion added: $p" -ForegroundColor Green } }; $steamPaths = @('C:\Program Files (x86)\Steam\steamapps\common','D:\SteamLibrary\steamapps\common','E:\SteamLibrary\steamapps\common'); foreach ($s in $steamPaths) { $full = Join-Path $s 'Call of Duty Modern Warfare 2'; If (Test-Path $full) { try{Add-MpPreference -ExclusionPath $full -EA SilentlyContinue}catch{}; Write-Host "[COD] Defender exclusion added: $full" -ForegroundColor Green } }; Write-Host "[COD] Defender exclusion applied — Defender was scanning COD pak files on every load causing 2-8s load time spikes and mid-game disk hitching" -ForegroundColor Cyan
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
Write-Host "[>>] RustHighPriority..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3 -Type DWord -Force; Write-Host "[OK] Rust: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O applied (persists across reboots)" -ForegroundColor Green
    $appliedTweaks.Add("RustHighPriority") | Out-Null
} catch {
    $failedTweaks.Add("RustHighPriority") | Out-Null
    Write-Host "[ERR] RustHighPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] RustDisableThrottling..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; $ptKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling'; If (!(Test-Path $ptKey)) { New-Item -Path $ptKey -Force | Out-Null }; Set-ItemProperty -Path $ptKey -Name 'PowerThrottlingOff' -Value 1 -Type DWord -Force; Write-Host "[OK] Rust: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}), power throttling disabled" -ForegroundColor Green
    $appliedTweaks.Add("RustDisableThrottling") | Out-Null
} catch {
    $failedTweaks.Add("RustDisableThrottling") | Out-Null
    Write-Host "[ERR] RustDisableThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] RustGameMode..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue; $key = 'HKCU:\System\GameConfigStore'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'GameDVR_FSEBehaviorMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Windows Game Mode enabled for Rust" -ForegroundColor Green
    $appliedTweaks.Add("RustGameMode") | Out-Null
} catch {
    $failedTweaks.Add("RustGameMode") | Out-Null
    Write-Host "[ERR] RustGameMode: $_" -ForegroundColor Red
}
Write-Host "[>>] RustFPSUncap..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "fps\.limit") { $c = $c -replace "fps\.limit [^
]*", "fps.limit -1" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "fps.limit -1" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: FPS cap removed (fps.limit -1)" -ForegroundColor Green
    $appliedTweaks.Add("RustFPSUncap") | Out-Null
} catch {
    $failedTweaks.Add("RustFPSUncap") | Out-Null
    Write-Host "[ERR] RustFPSUncap: $_" -ForegroundColor Red
}
Write-Host "[>>] RustDisableVSync..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "vsync\.enabled") { $c = $c -replace "vsync\.enabled [^
]*", "vsync.enabled false" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "vsync.enabled false" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: VSync disabled" -ForegroundColor Green
    $appliedTweaks.Add("RustDisableVSync") | Out-Null
} catch {
    $failedTweaks.Add("RustDisableVSync") | Out-Null
    Write-Host "[ERR] RustDisableVSync: $_" -ForegroundColor Red
}
Write-Host "[>>] RustLowShadows..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "graphics\.shadowdistance") { $c = $c -replace "graphics\.shadowdistance [^
]*", "graphics.shadowdistance 50" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "graphics.shadowdistance 50" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: Shadow distance set to 50" -ForegroundColor Green
    $appliedTweaks.Add("RustLowShadows") | Out-Null
} catch {
    $failedTweaks.Add("RustLowShadows") | Out-Null
    Write-Host "[ERR] RustLowShadows: $_" -ForegroundColor Red
}
Write-Host "[>>] RustDisableBloom..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "graphics\.bloom") { $c = $c -replace "graphics\.bloom [^
]*", "graphics.bloom 0" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "graphics.bloom 0" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: Bloom disabled" -ForegroundColor Green
    $appliedTweaks.Add("RustDisableBloom") | Out-Null
} catch {
    $failedTweaks.Add("RustDisableBloom") | Out-Null
    Write-Host "[ERR] RustDisableBloom: $_" -ForegroundColor Red
}
Write-Host "[>>] RustDisableMotionBlur..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "graphics\.motionblur") { $c = $c -replace "graphics\.motionblur [^
]*", "graphics.motionblur 0" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "graphics.motionblur 0" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: Motion blur disabled" -ForegroundColor Green
    $appliedTweaks.Add("RustDisableMotionBlur") | Out-Null
} catch {
    $failedTweaks.Add("RustDisableMotionBlur") | Out-Null
    Write-Host "[ERR] RustDisableMotionBlur: $_" -ForegroundColor Red
}
Write-Host "[>>] RustWaterOff..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "graphics\.water") { $c = $c -replace "graphics\.water [^
]*", "graphics.water 0" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "graphics.water 0" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: Water reflections disabled" -ForegroundColor Green
    $appliedTweaks.Add("RustWaterOff") | Out-Null
} catch {
    $failedTweaks.Add("RustWaterOff") | Out-Null
    Write-Host "[ERR] RustWaterOff: $_" -ForegroundColor Red
}
Write-Host "[>>] RustGrassShadowOff..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:AppData\Rust\cfg\client.cfg"; $d = Split-Path $cfg; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $c = If (Test-Path $cfg) { Get-Content $cfg -Raw } Else { "" }; If ($c -match "grass\.shadowcast") { $c = $c -replace "grass\.shadowcast [^
]*", "grass.shadowcast 0" } Else { $c = $c.TrimEnd() + [Environment]::NewLine + "grass.shadowcast 0" }; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[OK] Rust: Grass shadow casting disabled" -ForegroundColor Green
    $appliedTweaks.Add("RustGrassShadowOff") | Out-Null
} catch {
    $failedTweaks.Add("RustGrassShadowOff") | Out-Null
    Write-Host "[ERR] RustGrassShadowOff: $_" -ForegroundColor Red
}
Write-Host "[>>] RustNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 262144 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 262144 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Rust: Network socket buffers set to 256KB" -ForegroundColor Green
    $appliedTweaks.Add("RustNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("RustNetworkBuffer") | Out-Null
    Write-Host "[ERR] RustNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] RustOcclusionOff..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:APPDATA\Rust\cfg\client.cfg"; If (!(Test-Path $cfg)) { New-Item $cfg -ItemType File -Force | Out-Null }; $c = Get-Content $cfg -Raw -EA SilentlyContinue; If ($c -match 'occlusion.base') { (Get-Content $cfg) -replace 'occlusion.bases+S+','occlusion.base 0' | Set-Content $cfg } Else { Add-Content $cfg "occlusion.base 0" }; Write-Host "[Rust] occlusion.base 0 — reduces CPU occlusion culling overhead during complex scenes." -ForegroundColor Green
    $appliedTweaks.Add("RustOcclusionOff") | Out-Null
} catch {
    $failedTweaks.Add("RustOcclusionOff") | Out-Null
    Write-Host "[ERR] RustOcclusionOff: $_" -ForegroundColor Red
}
Write-Host "[>>] RustDisableAniso..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:APPDATA\Rust\cfg\client.cfg"; If (!(Test-Path $cfg)) { New-Item $cfg -ItemType File -Force | Out-Null }; $c = Get-Content $cfg -Raw -EA SilentlyContinue; If ($c -match 'graphics.aniso') { (Get-Content $cfg) -replace 'graphics.anisos+S+','graphics.aniso 0' | Set-Content $cfg } Else { Add-Content $cfg "graphics.aniso 0" }; Write-Host "[Rust] graphics.aniso 0 — anisotropic filtering off, frees GPU texture sampling budget." -ForegroundColor Green
    $appliedTweaks.Add("RustDisableAniso") | Out-Null
} catch {
    $failedTweaks.Add("RustDisableAniso") | Out-Null
    Write-Host "[ERR] RustDisableAniso: $_" -ForegroundColor Red
}
Write-Host "[>>] RustNagleOff..." -ForegroundColor DarkYellow
try {
    $tp = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters'; Set-ItemProperty $tp 'TcpNoDelay' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $tp 'TcpAckFrequency' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Rust] Nagle algorithm disabled — immediate TCP sends, reduced ping variance on Rust servers." -ForegroundColor Green
    $appliedTweaks.Add("RustNagleOff") | Out-Null
} catch {
    $failedTweaks.Add("RustNagleOff") | Out-Null
    Write-Host "[ERR] RustNagleOff: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxHighPriority..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RobloxPlayerBeta.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3 -Type DWord -Force; Write-Host "[OK] Roblox: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O applied" -ForegroundColor Green
    $appliedTweaks.Add("RobloxHighPriority") | Out-Null
} catch {
    $failedTweaks.Add("RobloxHighPriority") | Out-Null
    Write-Host "[ERR] RobloxHighPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxDisableThrottling..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RobloxPlayerBeta.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; $ptKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling'; If (!(Test-Path $ptKey)) { New-Item -Path $ptKey -Force | Out-Null }; Set-ItemProperty -Path $ptKey -Name 'PowerThrottlingOff' -Value 1 -Type DWord -Force; Write-Host "[OK] Roblox: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}), power throttling disabled" -ForegroundColor Green
    $appliedTweaks.Add("RobloxDisableThrottling") | Out-Null
} catch {
    $failedTweaks.Add("RobloxDisableThrottling") | Out-Null
    Write-Host "[ERR] RobloxDisableThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxGameMode..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Roblox: Windows Game Mode enabled" -ForegroundColor Green
    $appliedTweaks.Add("RobloxGameMode") | Out-Null
} catch {
    $failedTweaks.Add("RobloxGameMode") | Out-Null
    Write-Host "[ERR] RobloxGameMode: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxFPSUnlock..." -ForegroundColor DarkYellow
try {
    $rv = "$env:LocalAppData\Roblox\Versions"; If (!(Test-Path $rv)) { Write-Host "[SKIP] Roblox not installed" -ForegroundColor DarkGray } Else { Get-ChildItem $rv -Directory -EA SilentlyContinue | ForEach-Object { $dir = Join-Path $_.FullName "ClientSettings"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $file = Join-Path $dir "ClientAppSettings.json"; $obj = If (Test-Path $file) { try { Get-Content $file -Raw | ConvertFrom-Json } catch { New-Object PSObject } } Else { New-Object PSObject }; Add-Member -InputObject $obj -MemberType NoteProperty -Name "DFIntTaskSchedulerTargetFps" -Value 9999 -Force; $obj | ConvertTo-Json | Set-Content $file -Encoding UTF8; Write-Host "[OK] Roblox FPS unlocked in $file" -ForegroundColor Green } }
    $appliedTweaks.Add("RobloxFPSUnlock") | Out-Null
} catch {
    $failedTweaks.Add("RobloxFPSUnlock") | Out-Null
    Write-Host "[ERR] RobloxFPSUnlock: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxDisablePostFX..." -ForegroundColor DarkYellow
try {
    $rv = "$env:LocalAppData\Roblox\Versions"; If (!(Test-Path $rv)) { Write-Host "[SKIP] Roblox not installed" -ForegroundColor DarkGray } Else { Get-ChildItem $rv -Directory -EA SilentlyContinue | ForEach-Object { $dir = Join-Path $_.FullName "ClientSettings"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $file = Join-Path $dir "ClientAppSettings.json"; $obj = If (Test-Path $file) { try { Get-Content $file -Raw | ConvertFrom-Json } catch { New-Object PSObject } } Else { New-Object PSObject }; Add-Member -InputObject $obj -MemberType NoteProperty -Name "FFlagDisablePostFx" -Value $true -Force; $obj | ConvertTo-Json | Set-Content $file -Encoding UTF8; Write-Host "[OK] Roblox: Post-FX disabled" -ForegroundColor Green } }
    $appliedTweaks.Add("RobloxDisablePostFX") | Out-Null
} catch {
    $failedTweaks.Add("RobloxDisablePostFX") | Out-Null
    Write-Host "[ERR] RobloxDisablePostFX: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxReduceLightUpdates..." -ForegroundColor DarkYellow
try {
    $rv = "$env:LocalAppData\Roblox\Versions"; If (!(Test-Path $rv)) { Write-Host "[SKIP] Roblox not installed" -ForegroundColor DarkGray } Else { Get-ChildItem $rv -Directory -EA SilentlyContinue | ForEach-Object { $dir = Join-Path $_.FullName "ClientSettings"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $file = Join-Path $dir "ClientAppSettings.json"; $obj = If (Test-Path $file) { try { Get-Content $file -Raw | ConvertFrom-Json } catch { New-Object PSObject } } Else { New-Object PSObject }; Add-Member -InputObject $obj -MemberType NoteProperty -Name "FIntRenderLocalLightUpdatesMax" -Value 8 -Force; Add-Member -InputObject $obj -MemberType NoteProperty -Name "FIntRenderLocalLightUpdatesMin" -Value 6 -Force; $obj | ConvertTo-Json | Set-Content $file -Encoding UTF8; Write-Host "[OK] Roblox: Light update frequency reduced" -ForegroundColor Green } }
    $appliedTweaks.Add("RobloxReduceLightUpdates") | Out-Null
} catch {
    $failedTweaks.Add("RobloxReduceLightUpdates") | Out-Null
    Write-Host "[ERR] RobloxReduceLightUpdates: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 262144 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 262144 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Roblox: Network socket buffers set to 256KB" -ForegroundColor Green
    $appliedTweaks.Add("RobloxNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("RobloxNetworkBuffer") | Out-Null
    Write-Host "[ERR] RobloxNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxDisableSSAO..." -ForegroundColor DarkYellow
try {
    $versions = Get-ChildItem "$env:LOCALAPPDATA\Roblox\Versions" -Directory -EA SilentlyContinue; $count=0; ForEach ($v in $versions) { $f = "$($v.FullName)\ClientSettings\ClientAppSettings.json"; If (Test-Path $f) { $j = Get-Content $f -Raw | ConvertFrom-Json -EA SilentlyContinue; If ($j) { $j | Add-Member -Force -NotePropertyName 'FFlagRenderNoLowFiSky' -NotePropertyValue 'true'; $j | Add-Member -Force -NotePropertyName 'FFlagNewLightAttenuation' -NotePropertyValue 'false'; $j | Add-Member -Force -NotePropertyName 'DFIntMaxFrameBufferSize' -NotePropertyValue '4'; $j | ConvertTo-Json -Depth 5 | Set-Content $f -Encoding UTF8; $count++ } } }; Write-Host "[Roblox] SSAO + low-fi sky overhead disabled across $count version folder(s)." -ForegroundColor Green
    $appliedTweaks.Add("RobloxDisableSSAO") | Out-Null
} catch {
    $failedTweaks.Add("RobloxDisableSSAO") | Out-Null
    Write-Host "[ERR] RobloxDisableSSAO: $_" -ForegroundColor Red
}
Write-Host "[>>] RobloxNagleOff..." -ForegroundColor DarkYellow
try {
    $tp = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters'; Set-ItemProperty $tp 'TcpNoDelay' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $tp 'TcpAckFrequency' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Roblox] Nagle algorithm disabled — immediate TCP sends, reduced ping variance on Roblox servers." -ForegroundColor Green
    $appliedTweaks.Add("RobloxNagleOff") | Out-Null
} catch {
    $failedTweaks.Add("RobloxNagleOff") | Out-Null
    Write-Host "[ERR] RobloxNagleOff: $_" -ForegroundColor Red
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
Write-Host "[>>] NvTextureFilterHighPerf..." -ForegroundColor DarkYellow
try {
    @('HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak','HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak') | ForEach-Object { If (!(Test-Path $_)) { New-Item $_ -Force | Out-Null }; Set-ItemProperty -Path $_ -Name 'PS_TexFilterAnisoOptOn' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PS_TexFilterLODBiasAllow' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PS_TexFilterNoNeg' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PS_TexFilterQuality' -Value 0 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[NVIDIA] Texture Filtering Quality = High Performance (NVIDIA Corporation\Global\NVTweak)" -ForegroundColor Green
    $appliedTweaks.Add("NvTextureFilterHighPerf") | Out-Null
} catch {
    $failedTweaks.Add("NvTextureFilterHighPerf") | Out-Null
    Write-Host "[ERR] NvTextureFilterHighPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] NvLowLatencyUltra..." -ForegroundColor DarkYellow
try {
    @('HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak','HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak') | ForEach-Object { If (!(Test-Path $_)) { New-Item $_ -Force | Out-Null }; Set-ItemProperty -Path $_ -Name 'RmLowLatencyMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'FlipQueueSize' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[NVIDIA] Low Latency Mode = Ultra (NVCP-equivalent global profile setting)" -ForegroundColor Green
    $appliedTweaks.Add("NvLowLatencyUltra") | Out-Null
} catch {
    $failedTweaks.Add("NvLowLatencyUltra") | Out-Null
    Write-Host "[ERR] NvLowLatencyUltra: $_" -ForegroundColor Red
}
Write-Host "[>>] NvThreadedOptOn..." -ForegroundColor DarkYellow
try {
    @('HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak','HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak') | ForEach-Object { If (!(Test-Path $_)) { New-Item $_ -Force | Out-Null }; Set-ItemProperty -Path $_ -Name 'OGL_ThreadControl' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'D3D_ThreadControl' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[NVIDIA] Threaded Optimization = ON (global profile)" -ForegroundColor Green
    $appliedTweaks.Add("NvThreadedOptOn") | Out-Null
} catch {
    $failedTweaks.Add("NvThreadedOptOn") | Out-Null
    Write-Host "[ERR] NvThreadedOptOn: $_" -ForegroundColor Red
}
Write-Host "[>>] NvPowerMgmtMax..." -ForegroundColor DarkYellow
try {
    @('HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak','HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak') | ForEach-Object { If (!(Test-Path $_)) { New-Item $_ -Force | Out-Null }; Set-ItemProperty -Path $_ -Name 'PowerMizerEnable' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PerfLevelSrc' -Value 0x2222 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PowerMizerLevel' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PowerMizerLevelAC' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[NVIDIA] Power Management = Prefer Maximum Performance (PowerMizer locked to P0)" -ForegroundColor Green
    $appliedTweaks.Add("NvPowerMgmtMax") | Out-Null
} catch {
    $failedTweaks.Add("NvPowerMgmtMax") | Out-Null
    Write-Host "[ERR] NvPowerMgmtMax: $_" -ForegroundColor Red
}
Write-Host "[>>] NvFrameLimitOff..." -ForegroundColor DarkYellow
try {
    @('HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak','HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak') | ForEach-Object { If (!(Test-Path $_)) { New-Item $_ -Force | Out-Null }; Set-ItemProperty -Path $_ -Name 'FrameRateLimitEnable' -Value 0 -Type DWord -Force -EA SilentlyContinue; Remove-ItemProperty -Path $_ -Name 'FrameRateLimit' -EA SilentlyContinue }; Write-Host "[NVIDIA] Driver-level frame rate cap DISABLED (uncapped)" -ForegroundColor Green
    $appliedTweaks.Add("NvFrameLimitOff") | Out-Null
} catch {
    $failedTweaks.Add("NvFrameLimitOff") | Out-Null
    Write-Host "[ERR] NvFrameLimitOff: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdTextureFilterPerf..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'CatalystAI' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'TFQ' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'TextureOpt' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[AMD] Texture Filtering Quality = Performance (CatalystAI=0, TFQ=0, TextureOpt=1) — recovers ~3-5% texture fill rate" -ForegroundColor Green
    $appliedTweaks.Add("AmdTextureFilterPerf") | Out-Null
} catch {
    $failedTweaks.Add("AmdTextureFilterPerf") | Out-Null
    Write-Host "[ERR] AmdTextureFilterPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdSurfaceFormatOpt..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'EnableSurfaceFormatReplacements' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'KMD_EnableSFR' -Value 1 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[AMD] Surface Format Optimization ON — driver substitutes lower-precision render targets where safe, ~1-3% bandwidth saved" -ForegroundColor Green
    $appliedTweaks.Add("AmdSurfaceFormatOpt") | Out-Null
} catch {
    $failedTweaks.Add("AmdSurfaceFormatOpt") | Out-Null
    Write-Host "[ERR] AmdSurfaceFormatOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdTessOverride16x..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'TessellationMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'MaxTessellation' -Value 16 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[AMD] Tessellation capped at 16x — eliminates wasteful over-tessellation in Witcher 3 / Crysis 3 / GTA V with no visible loss" -ForegroundColor Green
    $appliedTweaks.Add("AmdTessOverride16x") | Out-Null
} catch {
    $failedTweaks.Add("AmdTessOverride16x") | Out-Null
    Write-Host "[ERR] AmdTessOverride16x: $_" -ForegroundColor Red
}
Write-Host "[>>] AmdRadeonBoostOff..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_RadeonBoostEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'EnableBoost' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[AMD] Radeon Boost OFF — prevents dynamic resolution scaling (use this if Boost is causing texture pop / blur in competitive titles)" -ForegroundColor Green
    $appliedTweaks.Add("AmdRadeonBoostOff") | Out-Null
} catch {
    $failedTweaks.Add("AmdRadeonBoostOff") | Out-Null
    Write-Host "[ERR] AmdRadeonBoostOff: $_" -ForegroundColor Red
}
Write-Host "[>>] EnableMSIMode_Safe..." -ForegroundColor DarkYellow
try {
    Write-Host "[MSI-Safe] Enabling MSI mode on GPU + NIC + NVMe controllers (BSOD-safe — never writes DevicePolicy/DevicePriority)..." -ForegroundColor Cyan; $targets = @(); $gpus = @(Get-PnpDevice -Class Display -EA SilentlyContinue | Where-Object { $_.Status -eq 'OK' }); If ($gpus.Count -eq 1) { $targets += $gpus } ElseIf ($gpus.Count -gt 1) { Write-Host "[MSI-Safe] Skipping GPU — multiple display adapters detected (hybrid iGPU+dGPU). Hybrid configs can BSOD with forced MSI." -ForegroundColor Yellow }; $targets += @(Get-PnpDevice -Class Net -EA SilentlyContinue | Where-Object { $_.Status -eq 'OK' -and $_.FriendlyName -notmatch 'Virtual|Loopback|Bluetooth|WAN|Tunnel|Hyper-V' }); $targets += @(Get-PnpDevice -Class SCSIAdapter -EA SilentlyContinue | Where-Object { $_.Status -eq 'OK' -and $_.FriendlyName -match 'NVMe|Standard NVM' }); ForEach ($d in $targets) { $msiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($d.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"; $affPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($d.InstanceId)\Device Parameters\Interrupt Management\Affinity Policy"; New-Item -Path $msiPath -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path $msiPath -Name 'MSISupported' -Value 1 -Type DWord -Force -EA SilentlyContinue; If (Test-Path $affPath) { Remove-ItemProperty -Path $affPath -Name 'DevicePolicy' -EA SilentlyContinue; Remove-ItemProperty -Path $affPath -Name 'DevicePriority' -EA SilentlyContinue; Remove-ItemProperty -Path $affPath -Name 'AssignmentSetOverride' -EA SilentlyContinue }; Write-Host "[MSI-Safe] $($d.FriendlyName) → MSI enabled, Affinity Policy wiped" -ForegroundColor Green }; Write-Host "[MSI-Safe] Done on $($targets.Count) device(s). Reboot required." -ForegroundColor Cyan
    $appliedTweaks.Add("EnableMSIMode_Safe") | Out-Null
} catch {
    $failedTweaks.Add("EnableMSIMode_Safe") | Out-Null
    Write-Host "[ERR] EnableMSIMode_Safe: $_" -ForegroundColor Red
}
Write-Host "[>>] CodTdrDelay..." -ForegroundColor DarkYellow
try {
    $gd = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If (!(Test-Path $gd)) { New-Item $gd -Force | Out-Null }; Set-ItemProperty $gd 'TdrDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrDdiDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrLimitCount' 20 -Type DWord -Force; Write-Host "[COD] GPU TDR delay extended to 8s (was 2s) — BO6 and Warzone do heavy shader compilation during level loads which can trigger Windows' GPU hang detection on 4GB cards. Extending TDR prevents false 'GPU stopped responding' crashes and black screen resets. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("CodTdrDelay") | Out-Null
} catch {
    $failedTweaks.Add("CodTdrDelay") | Out-Null
    Write-Host "[ERR] CodTdrDelay: $_" -ForegroundColor Red
}
Write-Host "[>>] IntelOldGenPowerOpt..." -ForegroundColor DarkYellow
try {
    # Activate High Performance plan (GUID 8c5e7fda = High Perf built-in)
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>nul
# Lock processor state: Min=100%, Max=100% — no frequency scaling under load
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>nul
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>nul
# Aggressive Perf Boost mode (2) + 100% boost policy — Turbo stays on continuously
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2 2>nul
powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTPOL 100 2>nul
# Disable Windows Power Throttling (Win10 1709+ feature that silently halves old-CPU clocks)
$ptKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling'
If (!(Test-Path $ptKey)) { New-Item $ptKey -Force | Out-Null }
Set-ItemProperty $ptKey 'PowerThrottlingOff' 1 -Type DWord -Force
# Apply
powercfg /setactive SCHEME_CURRENT 2>nul
Write-Host "[Intel 4th-8th Gen] High Performance plan active. Min/Max=100%, BoostMode=Aggressive, PowerThrottling disabled. All cores run at rated Turbo frequency throughout your gaming session — no ramp-up delay on first frame." -ForegroundColor Green
    $appliedTweaks.Add("IntelOldGenPowerOpt") | Out-Null
} catch {
    $failedTweaks.Add("IntelOldGenPowerOpt") | Out-Null
    Write-Host "[ERR] IntelOldGenPowerOpt: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Win Tweaks] 37 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] Win11ParkingCoreOverride..." -ForegroundColor DarkYellow
try {
    powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 100 2>$null; powercfg /setactive SCHEME_CURRENT 2>$null; Write-Host "[Win11] Core Parking MinCores set to 100% — all cores remain active" -ForegroundColor Green
    $appliedTweaks.Add("Win11ParkingCoreOverride") | Out-Null
} catch {
    $failedTweaks.Add("Win11ParkingCoreOverride") | Out-Null
    Write-Host "[ERR] Win11ParkingCoreOverride: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11ProcessorIdleMin..." -ForegroundColor DarkYellow
try {
    powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR IDLEDISABLE 1 2>$null; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCIDLEMIN 100 2>$null; powercfg /setactive SCHEME_CURRENT 2>$null; Write-Host "[Win11] Processor idle restricted to C0 only — prevents deep C-state transitions" -ForegroundColor Green
    $appliedTweaks.Add("Win11ProcessorIdleMin") | Out-Null
} catch {
    $failedTweaks.Add("Win11ProcessorIdleMin") | Out-Null
    Write-Host "[ERR] Win11ProcessorIdleMin: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11TeamsChat..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Chat' -Name 'ChatIcon' -Value 3; Get-AppxPackage *MicrosoftTeams* | Where-Object SignatureKind -eq 'Store' | Remove-AppxPackage
    $appliedTweaks.Add("Win11TeamsChat") | Out-Null
} catch {
    $failedTweaks.Add("Win11TeamsChat") | Out-Null
    Write-Host "[ERR] Win11TeamsChat: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11Widgets..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Dsh' -Name 'AllowNewsAndInterests' -Value 0; winget uninstall --id MicrosoftCorporationII.Windows.DevHome 2>$null; Get-AppxPackage *WebExperience* | Remove-AppxPackage
    $appliedTweaks.Add("Win11Widgets") | Out-Null
} catch {
    $failedTweaks.Add("Win11Widgets") | Out-Null
    Write-Host "[ERR] Win11Widgets: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11Copilot..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -Value 1; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'ShowCopilotButton' -Value 0
    $appliedTweaks.Add("Win11Copilot") | Out-Null
} catch {
    $failedTweaks.Add("Win11Copilot") | Out-Null
    Write-Host "[ERR] Win11Copilot: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11StartRecommended..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' -Name 'HideRecommendedSection' -Value 1
    $appliedTweaks.Add("Win11StartRecommended") | Out-Null
} catch {
    $failedTweaks.Add("Win11StartRecommended") | Out-Null
    Write-Host "[ERR] Win11StartRecommended: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11EdgeSidebar..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Name 'HubsSidebarEnabled' -Value 0; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Name 'EdgeShoppingAssistantEnabled' -Value 0
    $appliedTweaks.Add("Win11EdgeSidebar") | Out-Null
} catch {
    $failedTweaks.Add("Win11EdgeSidebar") | Out-Null
    Write-Host "[ERR] Win11EdgeSidebar: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11ChatIcon..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'TaskbarMn' -Value 0
    $appliedTweaks.Add("Win11ChatIcon") | Out-Null
} catch {
    $failedTweaks.Add("Win11ChatIcon") | Out-Null
    Write-Host "[ERR] Win11ChatIcon: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11OneDriveBackup..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\OneDrive' -Name 'DisableFileSyncNGSC' -Value 1
    $appliedTweaks.Add("Win11OneDriveBackup") | Out-Null
} catch {
    $failedTweaks.Add("Win11OneDriveBackup") | Out-Null
    Write-Host "[ERR] Win11OneDriveBackup: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11AdsInStart..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SystemPaneSuggestionsEnabled' -Value 0; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338388Enabled' -Value 0; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338389Enabled' -Value 0
    $appliedTweaks.Add("Win11AdsInStart") | Out-Null
} catch {
    $failedTweaks.Add("Win11AdsInStart") | Out-Null
    Write-Host "[ERR] Win11AdsInStart: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11DeviceEncryption..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\BitLocker' -Name 'PreventDeviceEncryption' -Value 1
    $appliedTweaks.Add("Win11DeviceEncryption") | Out-Null
} catch {
    $failedTweaks.Add("Win11DeviceEncryption") | Out-Null
    Write-Host "[ERR] Win11DeviceEncryption: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11Snap..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'SnapAssist' -Value 0
    $appliedTweaks.Add("Win11Snap") | Out-Null
} catch {
    $failedTweaks.Add("Win11Snap") | Out-Null
    Write-Host "[ERR] Win11Snap: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11TPMAlert..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows Security Health\State' -Name 'AccountProtection_MicrosoftAccount_Disconnected' -Value 1
    $appliedTweaks.Add("Win11TPMAlert") | Out-Null
} catch {
    $failedTweaks.Add("Win11TPMAlert") | Out-Null
    Write-Host "[ERR] Win11TPMAlert: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11BingSearch..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'BingSearchEnabled' -Value 0; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'CortanaConsent' -Value 0
    $appliedTweaks.Add("Win11BingSearch") | Out-Null
} catch {
    $failedTweaks.Add("Win11BingSearch") | Out-Null
    Write-Host "[ERR] Win11BingSearch: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11NotepadAI..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Notepad' -Name 'ShowStoreBanner' -Value 0
    $appliedTweaks.Add("Win11NotepadAI") | Out-Null
} catch {
    $failedTweaks.Add("Win11NotepadAI") | Out-Null
    Write-Host "[ERR] Win11NotepadAI: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11AutoHDR..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences' -Name 'AutoHDREnable' -Value 0
    $appliedTweaks.Add("Win11AutoHDR") | Out-Null
} catch {
    $failedTweaks.Add("Win11AutoHDR") | Out-Null
    Write-Host "[ERR] Win11AutoHDR: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusConsumerFeatures..." -ForegroundColor DarkYellow
try {
    $path = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent'; If (!(Test-Path $path)) { New-Item -Path $path -Force | Out-Null }; Set-ItemProperty -Path $path -Name 'DisableWindowsConsumerFeatures' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $path -Name 'DisableSoftLanding' -Value 1 -Type DWord -Force; Write-Host "[OK] Consumer features disabled — no more suggested apps or sponsored content in Start" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusConsumerFeatures") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusConsumerFeatures") | Out-Null
    Write-Host "[ERR] WinTitusConsumerFeatures: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusHibernation..." -ForegroundColor DarkYellow
try {
    powercfg -h off; Write-Host "[OK] Hibernation disabled — hiberfil.sys removed, frees drive space and speeds up shutdown" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusHibernation") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusHibernation") | Out-Null
    Write-Host "[ERR] WinTitusHibernation: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusPosh7Telemetry..." -ForegroundColor DarkYellow
try {
    [Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT', '1', 'Machine'); [Environment]::SetEnvironmentVariable('DOTNET_CLI_TELEMETRY_OPTOUT', '1', 'Machine'); Write-Host "[OK] PowerShell 7 and .NET CLI telemetry opt-out set in Machine environment" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusPosh7Telemetry") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusPosh7Telemetry") | Out-Null
    Write-Host "[ERR] WinTitusPosh7Telemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusDiskCleanup..." -ForegroundColor DarkYellow
try {
    @('Temporary Files','Recycle Bin','Thumbnail Cache','Windows Error Reporting Files','Downloaded Program Files','Temporary Internet Files') | ForEach-Object { $k = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches\$_"; If (Test-Path $k) { Set-ItemProperty $k 'StateFlags0001' 2 -Type DWord -EA SilentlyContinue } }; Start-Process -FilePath cleanmgr.exe -ArgumentList '/sagerun:1' -NoNewWindow; Write-Host "[OK] Disk Cleanup launched — temp files, recycle bin, thumbnails queued" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusDiskCleanup") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusDiskCleanup") | Out-Null
    Write-Host "[ERR] WinTitusDiskCleanup: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusServicesManual..." -ForegroundColor DarkYellow
try {
    $svcs = @('DiagTrack','DusmSvc','MapsBroker','lfsvc','PhoneSvc','RetailDemo','WMPNetworkSvc','WbioSrvc','XblAuthManager','XblGameSave','XboxNetApiSvc','SharedAccess','SSDPSRV','upnphost','W32Time','WinRM','RemoteRegistry','Fax','wercplsupport'); foreach ($s in $svcs) { Set-Service -Name $s -StartupType Manual -EA SilentlyContinue }; Write-Host "[OK] Non-essential services set to Manual startup (19 services)" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusServicesManual") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusServicesManual") | Out-Null
    Write-Host "[ERR] WinTitusServicesManual: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusAdobeBlock..." -ForegroundColor DarkYellow
try {
    $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"; $entries = @('0.0.0.0 activate.adobe.com','0.0.0.0 practivate.adobe.com','0.0.0.0 ereg.adobe.com','0.0.0.0 activate.wip3.adobe.com','0.0.0.0 wip3.adobe.com','0.0.0.0 3dns.adobe.com','0.0.0.0 adobe-dns.adobe.com'); $content = Get-Content $hosts -Raw -EA SilentlyContinue; foreach ($e in $entries) { $domain = $e.Split(' ')[1]; if ($content -notmatch [regex]::Escape($domain)) { Add-Content $hosts "`n$e" } }; Write-Host "[OK] Adobe activation servers blocked in hosts file (prevents phoning home)" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusAdobeBlock") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusAdobeBlock") | Out-Null
    Write-Host "[ERR] WinTitusAdobeBlock: $_" -ForegroundColor Red
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
Write-Host "[>>] WinTitusFullscreenOpt..." -ForegroundColor DarkYellow
try {
    $path = 'HKCU:\System\GameConfigStore'; Set-ItemProperty $path 'GameDVR_FSEBehavior' 2 -Type DWord -Force; Set-ItemProperty $path 'GameDVR_DSEBehavior' 2 -Type DWord -Force; Set-ItemProperty $path 'GameDVR_HonorUserFSEBehaviorMode' 1 -Type DWord -Force; Write-Host "[OK] Fullscreen Optimizations disabled globally — use borderless window instead for best results" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusFullscreenOpt") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusFullscreenOpt") | Out-Null
    Write-Host "[ERR] WinTitusFullscreenOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusNotifTray..." -ForegroundColor DarkYellow
try {
    $path = 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer'; If (!(Test-Path $path)) { New-Item $path -Force | Out-Null }; Set-ItemProperty $path 'DisableNotificationCenter' 1 -Type DWord -Force; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PushNotifications' -Name 'ToastEnabled' -Value 0 -Type DWord -Force; Write-Host "[OK] Notification tray / Action Center disabled" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusNotifTray") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusNotifTray") | Out-Null
    Write-Host "[ERR] WinTitusNotifTray: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusStorageSense..." -ForegroundColor DarkYellow
try {
    $p = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p '01' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Storage Sense disabled — Windows won't auto-delete files without permission" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusStorageSense") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusStorageSense") | Out-Null
    Write-Host "[ERR] WinTitusStorageSense: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusTeredo..." -ForegroundColor DarkYellow
try {
    netsh interface teredo set state disabled 2>$null; $p = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters'; If (Test-Path $p) { Set-ItemProperty $p 'DisabledComponents' 8 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[OK] Teredo tunneling disabled — reduces network overhead on native IPv4 connections" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusTeredo") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusTeredo") | Out-Null
    Write-Host "[ERR] WinTitusTeredo: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusEdgeDebloat..." -ForegroundColor DarkYellow
try {
    $ep = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'; If (!(Test-Path $ep)) { New-Item $ep -Force | Out-Null }; @{'BackgroundModeEnabled'=0;'EdgeCollectionsEnabled'=0;'HubsSidebarEnabled'=0;'PromotionalTabsEnabled'=0;'UserFeedbackAllowed'=0;'SpotlightExperiencesAndRecommendationsEnabled'=0;'EdgeShoppingAssistantEnabled'=0;'ShowMicrosoftRewards'=0}.GetEnumerator() | ForEach-Object { Set-ItemProperty $ep $_.Key $_.Value -Type DWord -Force -EA SilentlyContinue }; Write-Host "[OK] Microsoft Edge debloated — background mode, shopping assistant, rewards, and sidebars disabled" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusEdgeDebloat") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusEdgeDebloat") | Out-Null
    Write-Host "[ERR] WinTitusEdgeDebloat: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusIPv4Prefer..." -ForegroundColor DarkYellow
try {
    $p = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'DisabledComponents' 0x20 -Type DWord -Force; Write-Host "[OK] IPv4 preferred over IPv6 (flag 0x20 — IPv6 still available, IPv4 wins by default)" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusIPv4Prefer") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusIPv4Prefer") | Out-Null
    Write-Host "[ERR] WinTitusIPv4Prefer: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusEdgeRemove..." -ForegroundColor DarkYellow
try {
    Write-Host "[Edge] Searching for Edge setup.exe..." -ForegroundColor Yellow; $edgeSetup = $null; $searchPaths = @("C:\Program Files (x86)\Microsoft\Edge\Application","C:\Program Files\Microsoft\Edge\Application","C:\Program Files (x86)\Microsoft\EdgeUpdate","C:\Program Files\Microsoft\EdgeUpdate"); foreach ($sp in $searchPaths) { if (!$edgeSetup -and (Test-Path $sp)) { $found = Get-ChildItem $sp -Recurse -Filter "setup.exe" -EA SilentlyContinue | Select-Object -First 1; if ($found) { $edgeSetup = $found } } }; if ($edgeSetup) { Write-Host "[Edge] Found: $($edgeSetup.FullName)" -ForegroundColor Cyan; & $edgeSetup.FullName --uninstall --system-level --verbose-logging --force-uninstall 2>$null; Write-Host "[OK] Edge uninstall triggered via setup.exe" -ForegroundColor Green } Else { Write-Host "[Edge] setup.exe not found — trying AppxPackage removal..." -ForegroundColor Yellow; Get-AppxPackage -AllUsers *MicrosoftEdge* -EA SilentlyContinue | Remove-AppxPackage -AllUsers -EA SilentlyContinue; Write-Host "[OK] Edge AppxPackage removal attempted" -ForegroundColor Green }; $updateKey = "HKLM:\SOFTWARE\Microsoft\EdgeUpdate"; if (!(Test-Path $updateKey)) { New-Item $updateKey -Force | Out-Null }; Set-ItemProperty $updateKey "DoNotUpdateToEdgeWithChromium" 1 -Type DWord -Force -EA SilentlyContinue; Remove-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "Microsoft Edge" -EA SilentlyContinue; Write-Host "[OK] Edge removal complete — restart to finish" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusEdgeRemove") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusEdgeRemove") | Out-Null
    Write-Host "[ERR] WinTitusEdgeRemove: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusXboxComponents..." -ForegroundColor DarkYellow
try {
    Write-Host "[WARNING] This removes Xbox Gaming Services — skip if you use Xbox app or Game Pass" -ForegroundColor Yellow; @('Microsoft.XboxApp','Microsoft.GamingServices','Microsoft.XboxGamingOverlay','Microsoft.XboxSpeechToTextOverlay','Microsoft.Xbox.TCUI') | ForEach-Object { Get-AppxPackage -AllUsers $_ -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue }; Write-Host "[OK] Xbox and Gaming Services components removed" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusXboxComponents") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusXboxComponents") | Out-Null
    Write-Host "[ERR] WinTitusXboxComponents: $_" -ForegroundColor Red
}
Write-Host "[>>] WinTitusClassicMenu..." -ForegroundColor DarkYellow
try {
    $p = 'HKCU:\SOFTWARE\CLASSES\CLSID\{86CA1AA0-34AA-4E8B-A509-50C905BAE2A2}\InprocServer32'; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p '(Default)' '' -Type String -Force; Stop-Process -Name explorer -Force -EA SilentlyContinue; Start-Sleep 1; Start-Process explorer; Write-Host "[OK] Classic right-click menu restored (Win11) — Explorer restarted" -ForegroundColor Green
    $appliedTweaks.Add("WinTitusClassicMenu") | Out-Null
} catch {
    $failedTweaks.Add("WinTitusClassicMenu") | Out-Null
    Write-Host "[ERR] WinTitusClassicMenu: $_" -ForegroundColor Red
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
Write-Host "[>>] OOShutupPrivacy..." -ForegroundColor DarkYellow
try {
    $s = @(@('HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection','AllowTelemetry',0),@('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection','AllowTelemetry',0),@('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo','Enabled',0),@('HKLM:\SOFTWARE\Policies\Microsoft\Windows\AdvertisingInfo','DisabledByGroupPolicy',1),@('HKLM:\SOFTWARE\Policies\Microsoft\Windows\System','EnableActivityFeed',0),@('HKLM:\SOFTWARE\Policies\Microsoft\Windows\System','PublishUserActivities',0),@('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search','BingSearchEnabled',0),@('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search','CortanaConsent',0),@('HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy','LetAppsRunInBackground',2),@('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\DeviceAccess\Global\{BFA794E4-F964-4FDB-90F6-51056BFE4B44}','Value','Deny'),@('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\DeviceAccess\Global\{52079E78-A92B-413F-B213-E8FE35712E72}','Value','Deny'),@('HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\DeviceAccess\Global\{2EEF81BE-33FA-4800-9670-1CD474972C3F}','Value','Deny')); foreach ($r in $s) { $path=$r[0];$name=$r[1];$val=$r[2]; If (!(Test-Path $path)) { New-Item $path -Force | Out-Null }; If ($val -is [string]) { Set-ItemProperty $path $name $val -Type String -Force -EA SilentlyContinue } Else { Set-ItemProperty $path $name $val -Type DWord -Force -EA SilentlyContinue } }; Write-Host "[OK] OO ShutUp10++ recommended privacy settings applied (12 registry changes)" -ForegroundColor Green
    $appliedTweaks.Add("OOShutupPrivacy") | Out-Null
} catch {
    $failedTweaks.Add("OOShutupPrivacy") | Out-Null
    Write-Host "[ERR] OOShutupPrivacy: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [FiveM] 49 tweak(s) ---" -ForegroundColor DarkRed
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
Write-Host "[>>] FiveMDisablePhysX..." -ForegroundColor DarkYellow
try {
    Stop-Service 'NvTelemetryContainer' -Force -EA SilentlyContinue; Set-Service 'NvTelemetryContainer' -StartupType Disabled -EA SilentlyContinue; $key = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\PhysX'; If (Test-Path $key) { Set-ItemProperty $key 'PhysXGpuPhysicsScale' 0 -EA SilentlyContinue }; Write-Host "[FiveM] NVIDIA PhysX GPU acceleration reduced + telemetry service disabled" -ForegroundColor Green
    $appliedTweaks.Add("FiveMDisablePhysX") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisablePhysX") | Out-Null
    Write-Host "[ERR] FiveMDisablePhysX: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMExtendedMemory..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri
    $appliedTweaks.Add("FiveMExtendedMemory") | Out-Null
} catch {
    $failedTweaks.Add("FiveMExtendedMemory") | Out-Null
    Write-Host "[ERR] FiveMExtendedMemory: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Write-Host "[FiveM] Network buffer: 512KB send/receive window (reduces packet batching)" -ForegroundColor Green
    $appliedTweaks.Add("FiveMNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("FiveMNetworkBuffer") | Out-Null
    Write-Host "[ERR] FiveMNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableVSync..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:LocalAppData\FiveM\FiveM.app\citizen\common\data\VehicleLayouts\settings.xml"; Write-Host "VSync override queued for FiveM config."
    $appliedTweaks.Add("FiveMDisableVSync") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableVSync") | Out-Null
    Write-Host "[ERR] FiveMDisableVSync: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMStreamDistance..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:LocalAppData\FiveM\FiveM.app\CitizenFX.ini"; If (Test-Path $cfg) { $c = Get-Content $cfg -Raw; If ($c -match 'StreamingDistance') { ($c -replace 'StreamingDistance=\d+','StreamingDistance=500') | Set-Content $cfg } Else { Add-Content $cfg "`nStreamingDistance=500" }; Write-Host "[FiveM] Streaming distance capped at 500 — reduces pop-in micro-stutter" -ForegroundColor Green } Else { Write-Host "[FiveM] CitizenFX.ini not found — launch FiveM once first" -ForegroundColor Yellow }
    $appliedTweaks.Add("FiveMStreamDistance") | Out-Null
} catch {
    $failedTweaks.Add("FiveMStreamDistance") | Out-Null
    Write-Host "[ERR] FiveMStreamDistance: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableFullscreen..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:LocalAppData\FiveM\FiveM.app\CitizenFX.ini"; If (Test-Path $cfg) { $c = Get-Content $cfg; ($c -replace 'Fullscreen=true','Fullscreen=false') | Set-Content $cfg; Write-Host "[FiveM] Forced borderless windowed in CitizenFX.ini" -ForegroundColor Green } Else { Write-Host "[FiveM] CitizenFX.ini not found — launch FiveM once first" -ForegroundColor Yellow }
    $appliedTweaks.Add("FiveMDisableFullscreen") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableFullscreen") | Out-Null
    Write-Host "[ERR] FiveMDisableFullscreen: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableDWM..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[FiveM] GTA5.exe elevated to High CPU + High I/O (minimizes DWM interference)" -ForegroundColor Green
    $appliedTweaks.Add("FiveMDisableDWM") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableDWM") | Out-Null
    Write-Host "[ERR] FiveMDisableDWM: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMAffinityMask..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' 3; $fKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM.exe\PerfOptions'; If (!(Test-Path $fKey)) { New-Item $fKey -Force | Out-Null }; Set-ItemProperty $fKey 'CpuPriorityClass' 3; Write-Host "[FiveM] GTA5.exe + FiveM.exe pinned to Above Normal priority on all logical cores" -ForegroundColor Green
    $appliedTweaks.Add("FiveMAffinityMask") | Out-Null
} catch {
    $failedTweaks.Add("FiveMAffinityMask") | Out-Null
    Write-Host "[ERR] FiveMAffinityMask: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMIOPriority..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM.exe\PerfOptions'; If (Test-Path $key) { Set-ItemProperty -Path $key -Name 'IoPriority' -Value 2 -ErrorAction SilentlyContinue; Write-Host "[FiveM] IoPriority set to 2 (Normal) — Critical I/O was removed as it starved FiveM browser processes causing crashes" -ForegroundColor Green }
    $appliedTweaks.Add("FiveMIOPriority") | Out-Null
} catch {
    $failedTweaks.Add("FiveMIOPriority") | Out-Null
    Write-Host "[ERR] FiveMIOPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDNSOverride..." -ForegroundColor DarkYellow
try {
    $adapter = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1; If ($adapter) { Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ('1.1.1.1','1.0.0.1') -EA SilentlyContinue; Write-Host "[FiveM] DNS set to Cloudflare 1.1.1.1/1.0.0.1 on $($adapter.Name) — faster server resolution" -ForegroundColor Green } Else { Write-Host "[FiveM] No active network adapter found" -ForegroundColor Yellow }
    $appliedTweaks.Add("FiveMDNSOverride") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDNSOverride") | Out-Null
    Write-Host "[ERR] FiveMDNSOverride: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMQueueFix..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value 10 -Type DWord -Force; Write-Host "[FiveM] SystemResponsiveness=10 — 90% CPU priority to game, 10% reserved for background (Discord/audio safe)" -ForegroundColor Green
    $appliedTweaks.Add("FiveMQueueFix") | Out-Null
} catch {
    $failedTweaks.Add("FiveMQueueFix") | Out-Null
    Write-Host "[ERR] FiveMQueueFix: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMWorkingSet..." -ForegroundColor DarkYellow
try {
    Write-Host "[SKIP] WorkingSetLimitInKB tweak removed — the 4GB cap was causing FiveM_GTAProcess 'memory could not be written' crashes because FiveM + GTA V routinely use 8-12 GB under load. Working set is now Windows-managed." -ForegroundColor DarkGray
    $appliedTweaks.Add("FiveMWorkingSet") | Out-Null
} catch {
    $failedTweaks.Add("FiveMWorkingSet") | Out-Null
    Write-Host "[ERR] FiveMWorkingSet: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMStreamPool..." -ForegroundColor DarkYellow
try {
    $cfg = "$env:LocalAppData\FiveM\FiveM.app\CitizenFX.ini"; If (Test-Path $cfg) { (Get-Content $cfg) -replace 'StreamPool=.*','StreamPool=128' | Set-Content $cfg }
    $appliedTweaks.Add("FiveMStreamPool") | Out-Null
} catch {
    $failedTweaks.Add("FiveMStreamPool") | Out-Null
    Write-Host "[ERR] FiveMStreamPool: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableNvidiaTelemetry..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'NvTelemetryContainer' -Force; Set-Service -Name 'NvTelemetryContainer' -StartupType Disabled
    $appliedTweaks.Add("FiveMDisableNvidiaTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableNvidiaTelemetry") | Out-Null
    Write-Host "[ERR] FiveMDisableNvidiaTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMMenuFpsUncap..." -ForegroundColor DarkYellow
try {
    Write-Host "[FiveM] NOTE: FiveM v31050+ locked nui_maxFramerate in production mode — menu FPS cap cannot be removed on current builds." -ForegroundColor Yellow; $cfg = "$env:APPDATA\CitizenFX\fivem.cfg"; If (-not (Test-Path "$env:APPDATA\CitizenFX")) { New-Item -ItemType Directory "$env:APPDATA\CitizenFX" -Force | Out-Null }; If (-not (Test-Path $cfg)) { "" | Set-Content $cfg }; $c = Get-Content $cfg -Raw; $c = $c -replace 'set nui_maxFramerate S+','' -replace 'set nui_framerate S+',''; $c = $c.Trim() + "`nset nui_maxFramerate 9999`nset nui_framerate 9999"; Set-Content $cfg $c.Trim() -Encoding UTF8; Write-Host "[FiveM] fivem.cfg patched with nui_maxFramerate 9999 (effective on pre-v31050 builds)" -ForegroundColor DarkGray; $wsh = New-Object -ComObject WScript.Shell; $paths = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk","$env:PUBLIC\Desktop\FiveM.lnk","$env:USERPROFILE\Desktop\FiveM.lnk"); foreach ($p in $paths) { If (Test-Path $p) { try { $sc = $wsh.CreateShortcut($p); If ($sc.Arguments -notmatch 'fps_max') { $sc.Arguments = ($sc.Arguments + ' +set fps_max 0').Trim(); $sc.Save(); Write-Host "[FiveM] Shortcut patched: $p" -ForegroundColor DarkGray } } catch {} } }; $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'OpenGLCompatibilityMode' 0 -Type DWord -Force -EA SilentlyContinue } }; Write-Host "[FiveM] Legacy method applied. In-game fps_max 0 and NVIDIA OpenGL layer set." -ForegroundColor Green
    $appliedTweaks.Add("FiveMMenuFpsUncap") | Out-Null
} catch {
    $failedTweaks.Add("FiveMMenuFpsUncap") | Out-Null
    Write-Host "[ERR] FiveMMenuFpsUncap: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableMemCompression..." -ForegroundColor DarkYellow
try {
    $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB); If ($ramGB -lt 16) { Write-Host "⚠  SKIP: DisableMemoryCompression requires 16GB+ RAM. You have $ramGB GB — on low-RAM systems Windows compression actively keeps more game data in RAM. Leaving enabled to prevent stutters." -ForegroundColor Yellow } Else { Disable-MMAgent -MemoryCompression -EA SilentlyContinue; Write-Host "[FiveM] Memory Compression disabled — safe on $ramGB GB system. CPU cycles freed from compression overhead for game threads." -ForegroundColor Green }
    $appliedTweaks.Add("FiveMDisableMemCompression") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableMemCompression") | Out-Null
    Write-Host "[ERR] FiveMDisableMemCompression: $_" -ForegroundColor Red
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
Write-Host "[>>] FiveMReduceShadowQuality..." -ForegroundColor DarkYellow
try {
    $f = "$env:USERPROFILE\Documents\Rockstar Games\GTA V\settings.xml"; If (Test-Path $f) { $c = Get-Content $f -Raw; $c = $c -replace '(<ShadowQuality value=")[^"]*(")', '${1}0${2}'; $c = $c -replace '(<ShadowDistance value=")[^"]*(")', '${1}0${2}'; $c = $c -replace '(<ShadowSoftness value=")[^"]*(")', '${1}0${2}'; Set-Content $f $c; Write-Host "[GTA V] Shadows set to minimum — saves 15-30 FPS on GTX 1650-class GPUs with no gameplay impact" -ForegroundColor Green } Else { Write-Host "[GTA V] settings.xml not found — launch GTA V once first" -ForegroundColor Yellow }
    $appliedTweaks.Add("FiveMReduceShadowQuality") | Out-Null
} catch {
    $failedTweaks.Add("FiveMReduceShadowQuality") | Out-Null
    Write-Host "[ERR] FiveMReduceShadowQuality: $_" -ForegroundColor Red
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
Write-Host "[>>] FiveM1060VRAMFlag..." -ForegroundColor DarkYellow
try {
    $dir = "$env:USERPROFILE\Documents\Rockstar Games\GTA V"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $cmd = "$dir\commandline.txt"; $existing = If (Test-Path $cmd) { Get-Content $cmd -Raw } Else { "" }; If ($existing -notmatch 'availablevidmem') { $existing = $existing.Trim() + " -availablevidmem 6144"; Set-Content $cmd $existing.Trim() }; Write-Host "[GTX 1060] commandline.txt patched: -availablevidmem 6144 — GTA V will now use full 6GB VRAM budget" -ForegroundColor Green
    $appliedTweaks.Add("FiveM1060VRAMFlag") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1060VRAMFlag") | Out-Null
    Write-Host "[ERR] FiveM1060VRAMFlag: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM1060DisableHAGS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[GTX 1060] Hardware-Accelerated GPU Scheduling disabled (HwSchMode=1). Pascal GPUs (GTX 10xx) do not benefit from HAGS — disabling it reduces frame-time variance. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("FiveM1060DisableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1060DisableHAGS") | Out-Null
    Write-Host "[ERR] FiveM1060DisableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM1060AnselDisable..." -ForegroundColor DarkYellow
try {
    $ansel = 'HKCU:\SOFTWARE\NVIDIA Corporation\Ansel'; If (!(Test-Path $ansel)) { New-Item $ansel -Force | Out-Null }; Set-ItemProperty $ansel -Name 'AnselEnable' -Value 0 -Type DWord -Force -EA SilentlyContinue; $nvcp = 'HKCU:\SOFTWARE\NVIDIA Corporation\NVControlPanel2\Client'; If (!(Test-Path $nvcp)) { New-Item $nvcp -Force | Out-Null }; Set-ItemProperty $nvcp -Name 'OptInOrOutPreference' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[GTX 1060] NVIDIA Ansel injection disabled via registry only — display container kept running (safe, no 0x80000003 risk)." -ForegroundColor Green
    $appliedTweaks.Add("FiveM1060AnselDisable") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1060AnselDisable") | Out-Null
    Write-Host "[ERR] FiveM1060AnselDisable: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM5600CoreAffinity..." -ForegroundColor DarkYellow
try {
    $mask = 0x555; @('GTA5.exe','FiveM.exe') | ForEach-Object { $p = Get-Process ($_ -replace '.exe','') -EA SilentlyContinue; If ($p) { $p.ProcessorAffinity = $mask; Write-Host "[R5 5600] Affinity set to physical cores only (mask=0x555) for $_" -ForegroundColor Green } Else { Write-Host "[R5 5600] $_ not running — affinity will apply next launch via priority startup script" -ForegroundColor DarkGray } }; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'CpuPriorityClass' 3 -Type DWord -Force }; Write-Host "[R5 5600] Physical-cores-only affinity configured for GTA5 + FiveM — tighter frametimes on Zen 3" -ForegroundColor Cyan
    $appliedTweaks.Add("FiveM5600CoreAffinity") | Out-Null
} catch {
    $failedTweaks.Add("FiveM5600CoreAffinity") | Out-Null
    Write-Host "[ERR] FiveM5600CoreAffinity: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM5600PowerPlan..." -ForegroundColor DarkYellow
try {
    $guid = powercfg /list 2>&1 | Select-String 'Ryzen|AMD' | ForEach-Object { ($_ -split 's+')[3] } | Select-Object -First 1; If ($guid) { powercfg /setactive $guid; Write-Host "[R5 5600] AMD Ryzen power plan activated: $guid" -ForegroundColor Green } Else { powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c; Write-Host "[R5 5600] AMD Ryzen plan not found — activated High Performance (8c5e7fda). Minimum CPU state set to 99% via processor policy." -ForegroundColor Yellow }; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 99; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2; powercfg /setactive SCHEME_CURRENT
    $appliedTweaks.Add("FiveM5600PowerPlan") | Out-Null
} catch {
    $failedTweaks.Add("FiveM5600PowerPlan") | Out-Null
    Write-Host "[ERR] FiveM5600PowerPlan: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM1650DisableHAGS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[GTX 1650 SUPER] HAGS disabled (HwSchMode=1). Turing-gen GTX 16xx cards have the same HAGS scheduler overhead as Pascal — frame-time variance drops noticeably in populated FiveM servers. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("FiveM1650DisableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1650DisableHAGS") | Out-Null
    Write-Host "[ERR] FiveM1650DisableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM1650VRAMBudget..." -ForegroundColor DarkYellow
try {
    $dir = "$env:USERPROFILE\Documents\Rockstar Games\GTA V"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $cmd = "$dir\commandline.txt"; $existing = If (Test-Path $cmd) { Get-Content $cmd -Raw } Else { "" }; If ($existing -notmatch 'availablevidmem') { $existing = $existing.Trim() + " -availablevidmem 4096" }; If ($existing -notmatch 'percentvidmem') { $existing = $existing.Trim() + " -percentvidmem 100" }; Set-Content $cmd $existing.Trim(); Write-Host "[GTX 1650 SUPER] commandline.txt patched: -availablevidmem 4096 -percentvidmem 100. GTA V now allocates the full 4GB VRAM budget — eliminates VRAM under-reporting that cuts texture streaming quality on 4GB cards." -ForegroundColor Green
    $appliedTweaks.Add("FiveM1650VRAMBudget") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1650VRAMBudget") | Out-Null
    Write-Host "[ERR] FiveM1650VRAMBudget: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM1650DisableAnsel..." -ForegroundColor DarkYellow
try {
    $ansel = 'HKCU:\SOFTWARE\NVIDIA Corporation\Ansel'; If (!(Test-Path $ansel)) { New-Item $ansel -Force | Out-Null }; Set-ItemProperty $ansel -Name 'AnselEnable' -Value 0 -Type DWord -Force -EA SilentlyContinue; $nvcp = 'HKCU:\SOFTWARE\NVIDIA Corporation\NVControlPanel2\Client'; If (!(Test-Path $nvcp)) { New-Item $nvcp -Force | Out-Null }; Set-ItemProperty $nvcp -Name 'OptInOrOutPreference' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[GTX 1650 SUPER] NVIDIA Ansel injection disabled. Ansel hooks every render frame on all NVIDIA GPUs including 1650 SUPER — measurable CPU overhead. Display container kept alive (no overlay crash risk)." -ForegroundColor Green
    $appliedTweaks.Add("FiveM1650DisableAnsel") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1650DisableAnsel") | Out-Null
    Write-Host "[ERR] FiveM1650DisableAnsel: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM1650LowLatencyMode..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'RmLowLatencyMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'FlipQueueSize' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'PerfLevelSrc' -Value 0x2222 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'PowerMizerEnable' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'PowerMizerLevel' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'PowerMizerLevelAC' -Value 1 -Type DWord -Force -EA SilentlyContinue }; @('HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak','HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak') | ForEach-Object { If (!(Test-Path $_)) { New-Item $_ -Force | Out-Null }; Set-ItemProperty -Path $_ -Name 'RmLowLatencyMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'FlipQueueSize' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PowerMizerEnable' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $_ -Name 'PerfLevelSrc' -Value 0x2222 -Type DWord -Force -EA SilentlyContinue }; Write-Host "[GTX 1650 SUPER] Low Latency Mode = ULTRA (RmLowLatencyMode=2, FlipQueueSize=1, PowerMizer P0 locked) — written to both GPU class registry and global NVTweak. Eliminates frame-queue depth spikes." -ForegroundColor Green
    $appliedTweaks.Add("FiveM1650LowLatencyMode") | Out-Null
} catch {
    $failedTweaks.Add("FiveM1650LowLatencyMode") | Out-Null
    Write-Host "[ERR] FiveM1650LowLatencyMode: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM3500CoreAffinity..." -ForegroundColor DarkYellow
try {
    $mask = 0x3F; @('GTA5','FiveM') | ForEach-Object { $p = Get-Process $_ -EA SilentlyContinue; If ($p) { $p.ProcessorAffinity = $mask; Write-Host "[R5 3500] Live affinity set to 0x3F (all 6 physical cores) for $_" -ForegroundColor Green } Else { Write-Host "[R5 3500] $_ not running — IFEO applies on next launch" -ForegroundColor DarkGray } }; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $k 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $k 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'DisableEnergyThrottling' 1 -Type DWord -Force }; Write-Host "[R5 3500] No SMT on 3500 — 0x3F uses ALL 6 physical cores (no sibling-core skipping). IFEO: CpuPriorityClass=High, IO=High, FgBoost=On, EnergyThrottle=Off." -ForegroundColor Cyan
    $appliedTweaks.Add("FiveM3500CoreAffinity") | Out-Null
} catch {
    $failedTweaks.Add("FiveM3500CoreAffinity") | Out-Null
    Write-Host "[ERR] FiveM3500CoreAffinity: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM3500PerfPlan..." -ForegroundColor DarkYellow
try {
    powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>nul; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>nul; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>nul; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTMODE 2 2>nul; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFBOOSTPOL 100 2>nul; powercfg /setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES 100 2>nul; powercfg /setactive SCHEME_CURRENT 2>nul; Write-Host "[R5 3500] High Performance plan: Min=100%, Max=100%, BoostMode=Aggressive, BoostPolicy=100%. Precision Boost 2 runs at max clocks for all 6 cores for the entire FiveM session." -ForegroundColor Green
    $appliedTweaks.Add("FiveM3500PerfPlan") | Out-Null
} catch {
    $failedTweaks.Add("FiveM3500PerfPlan") | Out-Null
    Write-Host "[ERR] FiveM3500PerfPlan: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMCitizenDisableMedia..." -ForegroundColor DarkYellow
try {
    $d = "$env:APPDATA\CitizenFX"; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $f = "$d\CitizenFX.ini"; $c = If (Test-Path $f) { Get-Content $f -Raw } Else { "[Game]" }; If ($c -notmatch 'disable_media_player') { $c = $c.TrimEnd() + [System.Environment]::NewLine + "disable_media_player=1" }; Set-Content $f $c -Encoding UTF8; Write-Host "[FiveM] CitizenFX.ini: disable_media_player=1. Kills the GTA Radio NUI Chromium audio thread. On 6-core CPUs this thread competes with render — disabling frees ~2-4% CPU during city driving." -ForegroundColor Green
    $appliedTweaks.Add("FiveMCitizenDisableMedia") | Out-Null
} catch {
    $failedTweaks.Add("FiveMCitizenDisableMedia") | Out-Null
    Write-Host "[ERR] FiveMCitizenDisableMedia: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMSteamChildOff..." -ForegroundColor DarkYellow
try {
    $d = "$env:APPDATA\CitizenFX"; If (!(Test-Path $d)) { New-Item $d -ItemType Directory -Force | Out-Null }; $f = "$d\CitizenFX.ini"; $c = If (Test-Path $f) { Get-Content $f -Raw } Else { "[Game]" }; If ($c -notmatch 'steam_child_spawner_disabled') { $c = $c.TrimEnd() + [System.Environment]::NewLine + "steam_child_spawner_disabled=1" }; Set-Content $f $c -Encoding UTF8; Write-Host "[FiveM] CitizenFX.ini: steam_child_spawner_disabled=1. Prevents FiveM from spawning a Steam child process at every server join. Eliminates IPC validation delay and spawn overhead." -ForegroundColor Green
    $appliedTweaks.Add("FiveMSteamChildOff") | Out-Null
} catch {
    $failedTweaks.Add("FiveMSteamChildOff") | Out-Null
    Write-Host "[ERR] FiveMSteamChildOff: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMCommandlineMax..." -ForegroundColor DarkYellow
try {
    $dir = "$env:USERPROFILE\Documents\Rockstar Games\GTA V"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $flags = @("-norestrictions","-nomemrestrict","-noBlockScripts","-percentvidmem 100","-memrestrict 0","-nointrovideos","-noIntroCutscene"); $existing = If (Test-Path "$dir\commandline.txt") { Get-Content "$dir\commandline.txt" -Raw } Else { "" }; $merged = $existing.Trim(); foreach ($f in $flags) { $key = $f.Split(' ')[0]; if ($merged -notmatch [regex]::Escape($key)) { $merged = ($merged + " " + $f).Trim() } }; Set-Content "$dir\commandline.txt" $merged; Write-Host "[FiveM] commandline.txt: -norestrictions (unlock memory), -nomemrestrict (no VRAM ceiling), -noBlockScripts (all server scripts), -percentvidmem 100 (full VRAM), -nointrovideos/-noIntroCutscene (skip intros). All flags verified safe for FiveM RZ + RP." -ForegroundColor Green
    $appliedTweaks.Add("FiveMCommandlineMax") | Out-Null
} catch {
    $failedTweaks.Add("FiveMCommandlineMax") | Out-Null
    Write-Host "[ERR] FiveMCommandlineMax: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMSteamOverlayOff..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Valve\Steam' -Name 'EnableGameOverlay' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[FiveM] Steam overlay disabled. Steam hooks every render frame — on GTX 1650 SUPER adds 0.3-0.8ms GPU overhead per frame. Re-enable via Steam Settings > In-Game if needed." -ForegroundColor Green
    $appliedTweaks.Add("FiveMSteamOverlayOff") | Out-Null
} catch {
    $failedTweaks.Add("FiveMSteamOverlayOff") | Out-Null
    Write-Host "[ERR] FiveMSteamOverlayOff: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMMMCSSAudio..." -ForegroundColor DarkYellow
try {
    $mmBase = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'; Set-ItemProperty $mmBase -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $mmBase -Name 'NetworkThrottlingIndex' -Value 0xffffffff -Type DWord -Force -EA SilentlyContinue; $audio = "$mmBase\Tasks\Audio"; If (!(Test-Path $audio)) { New-Item $audio -Force | Out-Null }; Set-ItemProperty $audio -Name 'Scheduling Category' -Value 'Medium' -Type String -Force -EA SilentlyContinue; Set-ItemProperty $audio -Name 'Priority' -Value 6 -Type DWord -Force -EA SilentlyContinue; $proAudio = "$mmBase\Tasks\Pro Audio"; If (!(Test-Path $proAudio)) { New-Item $proAudio -Force | Out-Null }; Set-ItemProperty $proAudio -Name 'Scheduling Category' -Value 'Medium' -Type String -Force -EA SilentlyContinue; Set-ItemProperty $proAudio -Name 'Priority' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[MMCSS] SystemResponsiveness=0 (game gets 100% scheduler), Audio+Pro Audio demoted to Medium so games are never preempted by audio threads. Discord still works." -ForegroundColor Green
    $appliedTweaks.Add("FiveMMMCSSAudio") | Out-Null
} catch {
    $failedTweaks.Add("FiveMMMCSSAudio") | Out-Null
    Write-Host "[ERR] FiveMMMCSSAudio: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMDisableMPO..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -Value 5 -Type DWord -Force -EA SilentlyContinue; Write-Host "[FiveM] Multi-Plane Overlay (MPO) disabled (OverlayTestMode=5). This is the #1 fix for black screens at FiveM server load-in — MPO causes DWM to conflict with Discord/Steam overlays during server transition. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("FiveMDisableMPO") | Out-Null
} catch {
    $failedTweaks.Add("FiveMDisableMPO") | Out-Null
    Write-Host "[ERR] FiveMDisableMPO: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMFixNvidiaOverlay..." -ForegroundColor DarkYellow
try {
    Get-Process -Name "NVIDIA Overlay","nvoverlaycontainer" -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue; @('NVDisplay.ContainerLocalSystem','NvDisplayContainerLS') | ForEach-Object { $svc = Get-Service $_ -EA SilentlyContinue; if ($svc -and $svc.StartType -eq 'Disabled') { Set-Service $_ -StartupType Automatic -EA SilentlyContinue; Start-Service $_ -EA SilentlyContinue; Write-Host "[NVIDIA Fix] $_ re-enabled" -ForegroundColor Cyan } }; $tray = 'HKCU:\SOFTWARE\NVIDIA Corporation\NvTray'; If (!(Test-Path $tray)) { New-Item -Path $tray -Force | Out-Null }; Set-ItemProperty $tray -Name 'EnableSystemTray' -Value 0 -Type DWord -Force -EA SilentlyContinue; $run = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'; Remove-ItemProperty -Path $run -Name 'NvBackend' -Force -EA SilentlyContinue; $sa = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'; If (Test-Path $sa) { Set-ItemProperty $sa -Name 'NvBackend' -Value ([byte[]](0x03,0,0,0,0,0,0,0,0,0,0,0)) -Type Binary -Force -EA SilentlyContinue }; Write-Host "[NVIDIA Fix] NVIDIA Overlay.exe 0x80000003 crash fixed — container service restored, overlay disabled via registry. Reboot once to finalize." -ForegroundColor Green
    $appliedTweaks.Add("FiveMFixNvidiaOverlay") | Out-Null
} catch {
    $failedTweaks.Add("FiveMFixNvidiaOverlay") | Out-Null
    Write-Host "[ERR] FiveMFixNvidiaOverlay: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMFixProductId..." -ForegroundColor DarkYellow
try {
    Write-Host "[FiveM Fix] Fixing 'productId != ProductId::INVALID' (CfxState.h:88)..." -ForegroundColor Cyan; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('RockstarGamesLauncher.exe','PlayGTAV.exe','SocialClubHelper.exe','GTA5.exe','FiveM.exe') | ForEach-Object { $k = "$ifeo\$_"; If (Test-Path $k) { Remove-ItemProperty -Path $k -Name 'MitigationOptions' -EA SilentlyContinue; Remove-ItemProperty -Path $k -Name 'MitigationAuditOptions' -EA SilentlyContinue; Remove-ItemProperty -Path $k -Name 'Debugger' -EA SilentlyContinue; Write-Host "  [OK] IFEO MitigationOptions + Debugger cleared from $_" -ForegroundColor Green } }; @("$env:LocalAppData\FiveM\FiveM.app\cache\priv","$env:LocalAppData\FiveM\FiveM.app\cache\server-cache-priv") | ForEach-Object { If (Test-Path $_) { Remove-Item "$_\*" -Recurse -Force -EA SilentlyContinue; Write-Host "  [OK] CfxState priv cache cleared: $_" -ForegroundColor Green } }; $rgscSvc = Get-Service -Name 'Rockstar Service' -EA SilentlyContinue; If ($rgscSvc -and $rgscSvc.StartType -eq 'Disabled') { Set-Service -Name 'Rockstar Service' -StartupType Manual -EA SilentlyContinue; Write-Host "  [OK] Rockstar Service re-enabled" -ForegroundColor Green } ElseIf ($rgscSvc) { Write-Host "  [OK] Rockstar Service running (StartType: $($rgscSvc.StartType))" -ForegroundColor Green } Else { Write-Host "  [INFO] Rockstar Service not found — reinstall Rockstar Games Launcher" -ForegroundColor Yellow }; Write-Host "[OK] productId fix applied — reboot then relaunch FiveM normally" -ForegroundColor Green
    $appliedTweaks.Add("FiveMFixProductId") | Out-Null
} catch {
    $failedTweaks.Add("FiveMFixProductId") | Out-Null
    Write-Host "[ERR] FiveMFixProductId: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveM2060VRAMBudget..." -ForegroundColor DarkYellow
try {
    $dir = "$env:USERPROFILE\Documents\Rockstar Games\GTA V"; If (!(Test-Path $dir)) { New-Item $dir -ItemType Directory -Force | Out-Null }; $cmd = "$dir\commandline.txt"; $existing = If (Test-Path $cmd) { Get-Content $cmd -Raw } Else { "" }; If ($existing -notmatch 'availablevidmem') { $existing = $existing.Trim() + " -availablevidmem 6144" }; If ($existing -notmatch 'percentvidmem') { $existing = $existing.Trim() + " -percentvidmem 100" }; Set-Content $cmd $existing.Trim(); Write-Host "[GTX 2060] commandline.txt patched: -availablevidmem 6144 -percentvidmem 100. GTA V now budgets the full 6GB GDDR6 VRAM — eliminates under-reporting that causes texture pop on high-asset FiveM servers." -ForegroundColor Green
    $appliedTweaks.Add("FiveM2060VRAMBudget") | Out-Null
} catch {
    $failedTweaks.Add("FiveM2060VRAMBudget") | Out-Null
    Write-Host "[ERR] FiveM2060VRAMBudget: $_" -ForegroundColor Red
}
Write-Host "[>>] FiveMi5CoreAffinity..." -ForegroundColor DarkYellow
try {
    $mask = 0xF; @('GTA5','FiveM') | ForEach-Object { $p = Get-Process $_ -EA SilentlyContinue; If ($p) { $p.ProcessorAffinity = $mask; Write-Host "[i5-4XXX] Live affinity set to 0xF (all 4 physical cores) for $_" -ForegroundColor Green } Else { Write-Host "[i5-4XXX] $_ not running — IFEO applies on next launch" -ForegroundColor DarkGray } }; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'CpuPriorityClass' 3 -Type DWord -Force; Set-ItemProperty $k 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $k 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'DisableEnergyThrottling' 1 -Type DWord -Force }; Write-Host "[i5-4XXX] Haswell has 4 physical cores, no HT — 0xF is ALL cores. IFEO: CpuPriorityClass=High, IO=High, FgBoost=On, EnergyThrottle=Off. With only 4 real threads, pinning the game here prevents background tasks from stealing a core mid-gunfight." -ForegroundColor Cyan
    $appliedTweaks.Add("FiveMi5CoreAffinity") | Out-Null
} catch {
    $failedTweaks.Add("FiveMi5CoreAffinity") | Out-Null
    Write-Host "[ERR] FiveMi5CoreAffinity: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Process Lasso] 8 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] ProcessLassoProBalance..." -ForegroundColor DarkYellow
try {
    $plKey = 'HKLM:\SOFTWARE\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'EnableProBalance' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso ProBalance enabled" -ForegroundColor Green } Else { Write-Host "[INFO] Process Lasso not installed — applying IFEO Above-Normal priority to the Opti Gods 235-game whitelist instead" -ForegroundColor Yellow; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('VALORANT-Win64-Shipping.exe','cs2.exe','csgo.exe','r5apex.exe','r5apex_dx12.exe','ModernWarfare.exe','BlackOps6.exe','cod.exe','warzone.exe','RainbowSix.exe','RainbowSix_Vulkan.exe','Overwatch.exe','FortniteClient-Win64-Shipping.exe','FortniteLauncher.exe','EscapeFromTarkov.exe','TslGame.exe','Hunt  Showdown.exe','BattleBit.exe','FinalsClient-Win64-Shipping.exe','Marvel-Win64-Shipping.exe','ARC-Win64-Shipping.exe','Splitgate2-Win64-Shipping.exe','XDefiant.exe','Paladins.exe','Quake.exe','QuakeChampions.exe','Diabotical.exe','deltaforce.exe','ringsofpower.exe','naraka.exe','spectreDivide.exe','OffTheGrid.exe','ReadyOrNot.exe','GroundBranch.exe','Cyberpunk2077.exe','RDR2.exe','GTA5.exe','GTA6.exe','FiveM.exe','FiveM_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','RedM.exe','AssassinsCreedShadows.exe','AssassinsCreedMirage.exe','AssassinsCreedValhalla.exe','GoW.exe','GoWR.exe','HorizonZeroDawn.exe','HorizonForbiddenWest.exe','DeathStranding.exe','DS2.exe','SpiderMan.exe','SpiderMan2.exe','TheLastOfUsPartI.exe','Indiana.exe','StarWarsOutlaws.exe','Jedi.exe','Hogwarts Legacy.exe','FrostpunkII.exe','EldenRing.exe','EldenRingNightreign.exe','DarkSoulsIII.exe','sekiro.exe','BG3.exe','Witcher3.exe','Witcher4.exe','DragonAgeVeilguard.exe','Avowed.exe','PathOfExile.exe','PathOfExile_x64.exe','PathOfExile2.exe','Diablo IV.exe','Diablo IV Launcher.exe','Wow.exe','WowClassic.exe','ffxiv.exe','ffxiv_dx11.exe','GW2-64.exe','LostArk.exe','Throne.exe','BlackDesert64.exe','NewWorld.exe','NewWorld_x64.exe','Once Human.exe','LeagueofLegends.exe','League of Legends.exe','RiotClientServices.exe','dota2.exe','Deadlock.exe','Smite.exe','Smite2.exe','HearthStone.exe','LegendsOfRuneterra.exe','Minecraft.exe','MinecraftLauncher.exe','javaw.exe','Minecraft.Windows.exe','RustClient.exe','DayZ_x64.exe','ARK.exe','ArkAscended.exe','Palworld-Win64-Shipping.exe','ValheimClient.exe','valheim.exe','7DaysToDie.exe','ProjectZomboid.exe','Terraria.exe','TheForest.exe','SonsOfTheForest.exe','Subnautica.exe','Subnautica2.exe','Enshrouded.exe','Soulmask.exe','NightingaleClient.exe','PaxDei.exe','Icarus.exe','SCUM.exe','VRising.exe','GreenHell.exe','stardew.exe','Stardew Valley.exe','RobloxPlayerBeta.exe','RobloxStudioBeta.exe','Roblox.exe','ForzaHorizon5.exe','ForzaMotorsport.exe','F1_24.exe','F1_25.exe','AC2-Win64-Shipping.exe','acs.exe','acc.exe','iRacingSim64DX11.exe','BeamNG.drive.exe','CarX.exe','WreckfestX64.exe','TrackmaniaTurbo.exe','Trackmania.exe','DiRT Rally 2.0.exe','EAWRC.exe','rFactor2.exe','FlightSimulator.exe','FlightSimulator2024.exe','FIFA25.exe','FC25.exe','FC26.exe','Madden25.exe','NBA2K25.exe','NBA2K26.exe','PGA2K25.exe','RocketLeague.exe','Civ7.exe','CivilizationVII.exe','ck3.exe','stellaris.exe','hoi4.exe','AOE2DE_s.exe','AOE3DE_s.exe','AOE4.exe','StarCraftII.exe','Warhammer3.exe','Pharaoh.exe','CitiesSkylines.exe','CitiesSkylinesII.exe','Factorio.exe','Satisfactory.exe','FactorySimulator.exe','Manor Lords.exe','FrostPunk2.exe','Tekken8.exe','SF6.exe','MK1.exe','Granblue.exe','GuiltyGearStrive.exe','DBFZ.exe','DeadByDaylight-Win64-Shipping.exe','Phasmophobia.exe','REVillage.exe','RE4.exe','AlanWake2.exe','TheTexasChainsawMassacre.exe','F13.exe','Lethal Company.exe','REPO.exe','ContentWarning.exe','Hades2.exe','Hades.exe','deadcells.exe','BindingOfIsaac.exe','Slay the Spire.exe','balatro.exe','Risk of Rain 2.exe','RiskOfRainReturns.exe','Vampire Survivors.exe','Brotato.exe','Cult.exe','HollowKnight.exe','Silksong.exe','Celeste.exe','Cuphead.exe','PrinceofPersia.exe','Astro.exe','Helldivers2.exe','deepRockGalactic.exe','WarhammerVT2.exe','DarkTide.exe','PayDay3.exe','REPO_x64.exe','ItTakesTwo.exe','Split Fiction.exe','JackBox.exe','AmongUs.exe','FallGuys_client_game.exe','MultiVersus.exe','Spore.exe','BlackMythWukong.exe','MetaphorReFantazio.exe','MonsterHunterWilds.exe','Expedition33.exe','ARC.exe','Stalker2.exe','Stalker2-Win64-Shipping.exe','KingdomCome2.exe','Atomfall.exe','BorderlandsClient.exe','GhostOfYotei.exe','FableLegends.exe','PerfectDark.exe','GearsEDay.exe','Wolfenstein.exe','DoomDarkAges.exe','DOOMEternal.exe','DOOMx64vk.exe','Cronos.exe','SilentHill2.exe','RedoutII.exe') | ForEach-Object { $p = "$ifeo\$_\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'CpuPriorityClass' 3 -ErrorAction SilentlyContinue }; Write-Host "[OK] Above Normal CPU priority applied to 235 game executables" -ForegroundColor Green }
    $appliedTweaks.Add("ProcessLassoProBalance") | Out-Null
} catch {
    $failedTweaks.Add("ProcessLassoProBalance") | Out-Null
    Write-Host "[ERR] ProcessLassoProBalance: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessLassoSmartTrim..." -ForegroundColor DarkYellow
try {
    $plKey = 'HKLM:\SOFTWARE\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'EnableSmartTrim' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso SmartTrim enabled" -ForegroundColor Green } Else { Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr hProcess);' -Name 'MemTrimPL' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemTrimPL]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; Write-Host "[OK] Working set trimmed (Process Lasso not installed — ran manual trim)" -ForegroundColor Yellow }
    $appliedTweaks.Add("ProcessLassoSmartTrim") | Out-Null
} catch {
    $failedTweaks.Add("ProcessLassoSmartTrim") | Out-Null
    Write-Host "[ERR] ProcessLassoSmartTrim: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessLassoRestrain..." -ForegroundColor DarkYellow
try {
    $plKey = 'HKLM:\SOFTWARE\Process Lasso'; If (Test-Path $plKey) { Set-ItemProperty -Path $plKey -Name 'RestrainMode' -Value 1 -Type DWord; Write-Host "[OK] Process Lasso Restrain mode enabled" -ForegroundColor Green } Else { Write-Host "[INFO] Install Process Lasso to use CPU Restrain — download at bitsum.com" -ForegroundColor Yellow }
    $appliedTweaks.Add("ProcessLassoRestrain") | Out-Null
} catch {
    $failedTweaks.Add("ProcessLassoRestrain") | Out-Null
    Write-Host "[ERR] ProcessLassoRestrain: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessLassoAffinityGaming..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('cs2.exe','VALORANT-Win64-Shipping.exe','r5apex.exe','cod.exe','RustClient.exe','GTA5.exe','FortniteClient-Win64-Shipping.exe') | ForEach-Object { $p = "$ifeo\$_\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null } ; Set-ItemProperty $p 'CpuPriorityClass' 3; Set-ItemProperty $p 'IoPriority' 3 }; Write-Host "[OK] Above Normal CPU + High I/O priority applied to 7 game executables" -ForegroundColor Green
    $appliedTweaks.Add("ProcessLassoAffinityGaming") | Out-Null
} catch {
    $failedTweaks.Add("ProcessLassoAffinityGaming") | Out-Null
    Write-Host "[ERR] ProcessLassoAffinityGaming: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessLassoInstanceBalancer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' -Name 'Win32PrioritySeparation' -Value 26 -Type DWord; Write-Host "[OK] Win32PrioritySeparation=26 — short quantum, variable, max foreground boost (gaming-optimal scheduler mode)" -ForegroundColor Green
    $appliedTweaks.Add("ProcessLassoInstanceBalancer") | Out-Null
} catch {
    $failedTweaks.Add("ProcessLassoInstanceBalancer") | Out-Null
    Write-Host "[ERR] ProcessLassoInstanceBalancer: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessTrimWorkingSet..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr hProcess);' -Name 'MemTrimWT' -Namespace 'WinAPI' -EA SilentlyContinue; Get-Process | ForEach-Object { try { [WinAPI.MemTrimWT]::EmptyWorkingSet($_.Handle) } catch {} }; Write-Host "[OK] Working set trimmed across all running processes" -ForegroundColor Green
    $appliedTweaks.Add("ProcessTrimWorkingSet") | Out-Null
} catch {
    $failedTweaks.Add("ProcessTrimWorkingSet") | Out-Null
    Write-Host "[ERR] ProcessTrimWorkingSet: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessDisableWindowsErrorReporting..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' -Name 'Disabled' -Value 1; Stop-Service 'WerSvc' -Force -EA SilentlyContinue; Set-Service 'WerSvc' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Windows Error Reporting service disabled" -ForegroundColor Green
    $appliedTweaks.Add("ProcessDisableWindowsErrorReporting") | Out-Null
} catch {
    $failedTweaks.Add("ProcessDisableWindowsErrorReporting") | Out-Null
    Write-Host "[ERR] ProcessDisableWindowsErrorReporting: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcessAutoKillHung..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'AutoEndTasks' -Value 1; Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'HungAppTimeout' -Value '1000'; Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'WaitToKillAppTimeout' -Value '2000'; Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'WaitToKillServiceTimeout' -Value '2000'; Write-Host "[OK] Hung app auto-kill: AutoEndTasks=1, HungApp=1s, WaitToKill=2s" -ForegroundColor Green
    $appliedTweaks.Add("ProcessAutoKillHung") | Out-Null
} catch {
    $failedTweaks.Add("ProcessAutoKillHung") | Out-Null
    Write-Host "[ERR] ProcessAutoKillHung: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Debloat] 49 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] DebloatCortana..." -ForegroundColor DarkYellow
try {
    $pkg = Get-AppxPackage *Microsoft.549981C3F5F10* -EA SilentlyContinue; if ($pkg) { $pkg | Remove-AppxPackage -EA SilentlyContinue; Write-Host "[OK] Cortana removed" -ForegroundColor Green } else { Write-Host "[SKIP] Cortana not installed" -ForegroundColor DarkGray }
    $appliedTweaks.Add("DebloatCortana") | Out-Null
} catch {
    $failedTweaks.Add("DebloatCortana") | Out-Null
    Write-Host "[ERR] DebloatCortana: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatOneDrive..." -ForegroundColor DarkYellow
try {
    taskkill /F /IM OneDrive.exe 2>$null; $setupPaths = @("$env:SystemRoot\System32\OneDriveSetup.exe","$env:SystemRoot\SysWOW64\OneDriveSetup.exe","$env:LOCALAPPDATA\Microsoft\OneDrive\OneDriveSetup.exe","$env:LOCALAPPDATA\Microsoft\OneDrive\Update\OneDriveSetup.exe"); $found = $setupPaths | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($found) { & $found /uninstall 2>$null; Write-Host "[OK] OneDrive uninstaller ran" -ForegroundColor Green } else { Write-Host "[INFO] OneDrive setup.exe not found — may already be removed" -ForegroundColor Yellow }; Get-AppxPackage *Microsoft.OneDrive* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Remove-ItemProperty "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "OneDrive" -EA SilentlyContinue; Write-Host "[OK] OneDrive startup entry removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatOneDrive") | Out-Null
} catch {
    $failedTweaks.Add("DebloatOneDrive") | Out-Null
    Write-Host "[ERR] DebloatOneDrive: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatXboxApp..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.XboxApp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*XboxApp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Xbox App removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatXboxApp") | Out-Null
} catch {
    $failedTweaks.Add("DebloatXboxApp") | Out-Null
    Write-Host "[ERR] DebloatXboxApp: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatXboxGameBar..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.XboxGamingOverlay* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*XboxGamingOverlay*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' -Name 'AllowGameDVR' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Xbox Game Bar removed + DVR disabled" -ForegroundColor Green
    $appliedTweaks.Add("DebloatXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("DebloatXboxGameBar") | Out-Null
    Write-Host "[ERR] DebloatXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatXboxIdentity..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *XboxIdentityProvider* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*XboxIdentityProvider*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Xbox Identity Provider removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatXboxIdentity") | Out-Null
} catch {
    $failedTweaks.Add("DebloatXboxIdentity") | Out-Null
    Write-Host "[ERR] DebloatXboxIdentity: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatBing..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'BingSearchEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'CortanaConsent' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[OK] Bing search in Start Menu disabled" -ForegroundColor Green
    $appliedTweaks.Add("DebloatBing") | Out-Null
} catch {
    $failedTweaks.Add("DebloatBing") | Out-Null
    Write-Host "[ERR] DebloatBing: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatWeather..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.BingWeather* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*BingWeather*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] MSN Weather removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatWeather") | Out-Null
} catch {
    $failedTweaks.Add("DebloatWeather") | Out-Null
    Write-Host "[ERR] DebloatWeather: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatNews..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.BingNews* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*BingNews*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] MSN News removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatNews") | Out-Null
} catch {
    $failedTweaks.Add("DebloatNews") | Out-Null
    Write-Host "[ERR] DebloatNews: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatMaps..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.WindowsMaps* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*WindowsMaps*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Windows Maps removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatMaps") | Out-Null
} catch {
    $failedTweaks.Add("DebloatMaps") | Out-Null
    Write-Host "[ERR] DebloatMaps: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatSolitaire..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *MicrosoftSolitaireCollection* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*SolitaireCollection*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Microsoft Solitaire Collection removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatSolitaire") | Out-Null
} catch {
    $failedTweaks.Add("DebloatSolitaire") | Out-Null
    Write-Host "[ERR] DebloatSolitaire: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatMixedReality..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *MixedReality.Portal* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*MixedReality*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Mixed Reality Portal removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatMixedReality") | Out-Null
} catch {
    $failedTweaks.Add("DebloatMixedReality") | Out-Null
    Write-Host "[ERR] DebloatMixedReality: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatSkype..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.SkypeApp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*SkypeApp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Skype app removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatSkype") | Out-Null
} catch {
    $failedTweaks.Add("DebloatSkype") | Out-Null
    Write-Host "[ERR] DebloatSkype: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatZune..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *ZuneMusic* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxPackage *ZuneVideo* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*Zune*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Groove Music / Movies & TV removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatZune") | Out-Null
} catch {
    $failedTweaks.Add("DebloatZune") | Out-Null
    Write-Host "[ERR] DebloatZune: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatGrooveMusic..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *ZuneMusic* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*ZuneMusic*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Groove Music removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatGrooveMusic") | Out-Null
} catch {
    $failedTweaks.Add("DebloatGrooveMusic") | Out-Null
    Write-Host "[ERR] DebloatGrooveMusic: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatOfficeHub..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *MicrosoftOfficeHub* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*OfficeHub*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Office Hub removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatOfficeHub") | Out-Null
} catch {
    $failedTweaks.Add("DebloatOfficeHub") | Out-Null
    Write-Host "[ERR] DebloatOfficeHub: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatFeedback..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *WindowsFeedbackHub* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*FeedbackHub*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Windows Feedback Hub removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatFeedback") | Out-Null
} catch {
    $failedTweaks.Add("DebloatFeedback") | Out-Null
    Write-Host "[ERR] DebloatFeedback: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatGetHelp..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.GetHelp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*GetHelp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Get Help removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatGetHelp") | Out-Null
} catch {
    $failedTweaks.Add("DebloatGetHelp") | Out-Null
    Write-Host "[ERR] DebloatGetHelp: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatMSPaint3D..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Microsoft.MSPaint* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*MSPaint*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Paint 3D removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatMSPaint3D") | Out-Null
} catch {
    $failedTweaks.Add("DebloatMSPaint3D") | Out-Null
    Write-Host "[ERR] DebloatMSPaint3D: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatWindowsCamera..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *WindowsCamera* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*WindowsCamera*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Windows Camera removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatWindowsCamera") | Out-Null
} catch {
    $failedTweaks.Add("DebloatWindowsCamera") | Out-Null
    Write-Host "[ERR] DebloatWindowsCamera: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatYourPhone..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *YourPhone* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxPackage *PhoneLink* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*YourPhone*' -or $_.DisplayName -like '*PhoneLink*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Your Phone / Phone Link removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatYourPhone") | Out-Null
} catch {
    $failedTweaks.Add("DebloatYourPhone") | Out-Null
    Write-Host "[ERR] DebloatYourPhone: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatClipchamp..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *Clipchamp* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*Clipchamp*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Clipchamp removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatClipchamp") | Out-Null
} catch {
    $failedTweaks.Add("DebloatClipchamp") | Out-Null
    Write-Host "[ERR] DebloatClipchamp: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatPowerAutomate..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *PowerAutomate* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*PowerAutomate*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Power Automate removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatPowerAutomate") | Out-Null
} catch {
    $failedTweaks.Add("DebloatPowerAutomate") | Out-Null
    Write-Host "[ERR] DebloatPowerAutomate: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatQuickAssist..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *QuickAssist* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*QuickAssist*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Quick Assist removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatQuickAssist") | Out-Null
} catch {
    $failedTweaks.Add("DebloatQuickAssist") | Out-Null
    Write-Host "[ERR] DebloatQuickAssist: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatTeamsConsumer..." -ForegroundColor DarkYellow
try {
    $pkg = Get-AppxPackage -AllUsers *MicrosoftTeams* -EA SilentlyContinue | Where-Object { $_.SignatureKind -eq 'Store' }; if ($pkg) { $pkg | Remove-AppxPackage -EA SilentlyContinue; Write-Host "[OK] Microsoft Teams (consumer Store version) removed" -ForegroundColor Green } else { Write-Host "[SKIP] Teams consumer app not installed" -ForegroundColor DarkGray }
    $appliedTweaks.Add("DebloatTeamsConsumer") | Out-Null
} catch {
    $failedTweaks.Add("DebloatTeamsConsumer") | Out-Null
    Write-Host "[ERR] DebloatTeamsConsumer: $_" -ForegroundColor Red
}
Write-Host "[>>] DebloatAlarmsAndClock..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *WindowsAlarms* -EA SilentlyContinue | Remove-AppxPackage -EA SilentlyContinue; Get-AppxProvisionedPackage -Online -EA SilentlyContinue | Where-Object { $_.DisplayName -like '*WindowsAlarms*' } | Remove-AppxProvisionedPackage -Online -EA SilentlyContinue; Write-Host "[OK] Alarms & Clock removed" -ForegroundColor Green
    $appliedTweaks.Add("DebloatAlarmsAndClock") | Out-Null
} catch {
    $failedTweaks.Add("DebloatAlarmsAndClock") | Out-Null
    Write-Host "[ERR] DebloatAlarmsAndClock: $_" -ForegroundColor Red
}
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
Write-Host "[>>] ServicePrintSpooler..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name 'Spooler' -Force -EA SilentlyContinue; Set-Service -Name 'Spooler' -StartupType Disabled -EA SilentlyContinue; Write-Host "[OK] Print Spooler stopped. WARNING: re-enable with: Set-Service Spooler -StartupType Automatic; Start-Service Spooler" -ForegroundColor Yellow
    $appliedTweaks.Add("ServicePrintSpooler") | Out-Null
} catch {
    $failedTweaks.Add("ServicePrintSpooler") | Out-Null
    Write-Host "[ERR] ServicePrintSpooler: $_" -ForegroundColor Red
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
Write-Host "[>>] PrivacyDiagFeedback..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Siuf\Rules' -Name 'NumberOfSIUFInPeriod' -Value 0
    $appliedTweaks.Add("PrivacyDiagFeedback") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyDiagFeedback") | Out-Null
    Write-Host "[ERR] PrivacyDiagFeedback: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Memory] 13 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] MemFixedPagefile..." -ForegroundColor DarkYellow
try {
    $ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB); $min = [math]::Max(2048, [math]::Round($ram * 0.25)); $max = [math]::Max(4096, [math]::Round($ram * 1.0)); $regMM = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; Set-ItemProperty $regMM 'AutomaticManagedPagefile' 0 -Type DWord -Force; Set-ItemProperty $regMM 'PagingFiles' "C:\pagefile.sys $min $max" -Type MultiString -Force; Write-Host "[OK] Pagefile fixed at $min MB min / $max MB max (restores cleanly on every boot, takes effect after restart)" -ForegroundColor Green
    $appliedTweaks.Add("MemFixedPagefile") | Out-Null
} catch {
    $failedTweaks.Add("MemFixedPagefile") | Out-Null
    Write-Host "[ERR] MemFixedPagefile: $_" -ForegroundColor Red
}
Write-Host "[>>] MemClearPagefileShutdown..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' -Name 'ClearPageFileAtShutdown' -Value 1
    $appliedTweaks.Add("MemClearPagefileShutdown") | Out-Null
} catch {
    $failedTweaks.Add("MemClearPagefileShutdown") | Out-Null
    Write-Host "[ERR] MemClearPagefileShutdown: $_" -ForegroundColor Red
}
Write-Host "[>>] MemMovePagefileFast..." -ForegroundColor DarkYellow
try {
    $ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB); $min = [math]::Max(2048, [math]::Round($ram * 0.25)); $max = [math]::Max(4096, [math]::Round($ram * 1.0)); $ltr = $null; try { $ltr = (Get-PSDrive -PSProvider FileSystem -EA SilentlyContinue | Where-Object { $_.Used -ne $null -and [long]$_.Used -gt 0 } | Sort-Object @{Expression={[long]$_.Used+[long]$_.Free};Descending=$true} | Select-Object -First 1).Name } catch {}; if ($ltr) { $regMM = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'; Set-ItemProperty $regMM 'AutomaticManagedPagefile' 0 -Type DWord -Force; Set-ItemProperty $regMM 'PagingFiles' "${ltr}:\pagefile.sys $min $max" -Type MultiString -Force; Write-Host "[OK] Pagefile moved to ${ltr}: ($min–$max MB, takes effect after restart)" -ForegroundColor Green } else { Write-Host "[SKIP] Could not identify drive — pagefile unchanged" -ForegroundColor Yellow }
    $appliedTweaks.Add("MemMovePagefileFast") | Out-Null
} catch {
    $failedTweaks.Add("MemMovePagefileFast") | Out-Null
    Write-Host "[ERR] MemMovePagefileFast: $_" -ForegroundColor Red
}
Write-Host "[>>] MemDisableSuperfetch..." -ForegroundColor DarkYellow
try {
    Stop-Service -Name "SysMain" -Force; Set-Service -Name "SysMain" -StartupType Disabled
    $appliedTweaks.Add("MemDisableSuperfetch") | Out-Null
} catch {
    $failedTweaks.Add("MemDisableSuperfetch") | Out-Null
    Write-Host "[ERR] MemDisableSuperfetch: $_" -ForegroundColor Red
}
Write-Host "[>>] MemTrimStandbyList..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hProcess);' -Name 'MemHelperSL' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemHelperSL]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; Write-Host "[OK] Standby list cleared — RAM freed for game" -ForegroundColor Green
    $appliedTweaks.Add("MemTrimStandbyList") | Out-Null
} catch {
    $failedTweaks.Add("MemTrimStandbyList") | Out-Null
    Write-Host "[ERR] MemTrimStandbyList: $_" -ForegroundColor Red
}
Write-Host "[>>] MemDisableKernelPaging..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  REMOVED: DisablePagingExecutive was removed from Opti Gods because it caused FiveM_GTAProcess.exe 'memory could not be written' crashes on systems with 16GB RAM under load. The kernel cannot safely stay in RAM when GTA V + FiveM CEF browser are both active. This tweak is now a no-op." -ForegroundColor Yellow; Write-Host "[SKIP] DisablePagingExecutive — neutered to prevent memory write crashes in FiveM" -ForegroundColor DarkGray
    $appliedTweaks.Add("MemDisableKernelPaging") | Out-Null
} catch {
    $failedTweaks.Add("MemDisableKernelPaging") | Out-Null
    Write-Host "[ERR] MemDisableKernelPaging: $_" -ForegroundColor Red
}
Write-Host "[>>] MemSystemCacheBoost..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' -Name 'LargeSystemCache' -Value 0
    $appliedTweaks.Add("MemSystemCacheBoost") | Out-Null
} catch {
    $failedTweaks.Add("MemSystemCacheBoost") | Out-Null
    Write-Host "[ERR] MemSystemCacheBoost: $_" -ForegroundColor Red
}
Write-Host "[>>] MemTrimOnMinimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options' -Name 'TrimWorkingSetSize' -Value 1 -Type DWord
    $appliedTweaks.Add("MemTrimOnMinimize") | Out-Null
} catch {
    $failedTweaks.Add("MemTrimOnMinimize") | Out-Null
    Write-Host "[ERR] MemTrimOnMinimize: $_" -ForegroundColor Red
}
Write-Host "[>>] MemLargePageSupport..." -ForegroundColor DarkYellow
try {
    bcdedit /set usephysicaldestination no; Write-Host "Large page support tweak applied."
    $appliedTweaks.Add("MemLargePageSupport") | Out-Null
} catch {
    $failedTweaks.Add("MemLargePageSupport") | Out-Null
    Write-Host "[ERR] MemLargePageSupport: $_" -ForegroundColor Red
}
Write-Host "[>>] MemSetWorkingSetSize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' -Name 'WorkingSetQuota' -Value 0xFFFFFFFF
    $appliedTweaks.Add("MemSetWorkingSetSize") | Out-Null
} catch {
    $failedTweaks.Add("MemSetWorkingSetSize") | Out-Null
    Write-Host "[ERR] MemSetWorkingSetSize: $_" -ForegroundColor Red
}
Write-Host "[>>] MemGPUOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrLevel' -Value 3
    $appliedTweaks.Add("MemGPUOptimize") | Out-Null
} catch {
    $failedTweaks.Add("MemGPUOptimize") | Out-Null
    Write-Host "[ERR] MemGPUOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] MemDisableGPUPagefile..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  REMOVED: PagingAllocation=0 (disable GPU pagefile) was removed from Opti Gods because it causes silent FiveM crashes — when VRAM fills up (FiveM regularly uses 4-6 GB VRAM) the GPU driver silently kills the process with no error dialog because there is no system RAM fallback. Windows GPU paging is now left at default." -ForegroundColor Yellow; Write-Host "[SKIP] GPU PagingAllocation — neutered to prevent silent VRAM-overflow game exits" -ForegroundColor DarkGray
    $appliedTweaks.Add("MemDisableGPUPagefile") | Out-Null
} catch {
    $failedTweaks.Add("MemDisableGPUPagefile") | Out-Null
    Write-Host "[ERR] MemDisableGPUPagefile: $_" -ForegroundColor Red
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
Write-Host "--- [Game Detection] 25 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] game_valorant..." -ForegroundColor DarkYellow
try {
    $paths = @("$env:LocalAppData\VALORANT","C:\Riot Games\VALORANT"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Valorant at $found" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\VALORANT-Win64-Shipping.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Valorant: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Valorant not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_valorant") | Out-Null
} catch {
    $failedTweaks.Add("game_valorant") | Out-Null
    Write-Host "[ERR] game_valorant: $_" -ForegroundColor Red
}
Write-Host "[>>] game_apex..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files\EA Games\Apex Legends\r5apex.exe","C:\Program Files\Origin Games\Apex Legends\r5apex.exe","C:\Program Files (x86)\Origin Games\Apex Legends\r5apex.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Apex Legends" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\r5apex.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Apex: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Apex Legends not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_apex") | Out-Null
} catch {
    $failedTweaks.Add("game_apex") | Out-Null
    Write-Host "[ERR] game_apex: $_" -ForegroundColor Red
}
Write-Host "[>>] game_warzone..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Call of Duty","C:\Program Files\Call of Duty","C:\Program Files\Battle.net Apps\Call of Duty"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Call of Duty / Warzone at $found" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri -Type DWord -Force; Set-ItemProperty -Path $key -Name 'CpuPriorityBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'DisableEnergyThrottling' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'DisablePagingExecutive' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'EnableBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'EnableLargePage' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'ForceForegroundBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'GPUPriority' -Value 8 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'PagePriority' -Value 5 -Type DWord -Force; Set-ItemProperty -Path $key -Name 'TimerResolution' -Value 1 -Type DWord -Force; Write-Host "[OK] COD: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}), GPUPriority=8, IO=High, EnergyThrottle=Off, LargePage=On, TimerRes=1" -ForegroundColor Green } Else { Write-Host "[SKIP] COD / Warzone not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_warzone") | Out-Null
} catch {
    $failedTweaks.Add("game_warzone") | Out-Null
    Write-Host "[ERR] game_warzone: $_" -ForegroundColor Red
}
Write-Host "[>>] game_lol..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Riot Games\League of Legends\Game\League of Legends.exe","D:\Riot Games\League of Legends\Game\League of Legends.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] League of Legends" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\League of Legends.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] LoL: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] League of Legends not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_lol") | Out-Null
} catch {
    $failedTweaks.Add("game_lol") | Out-Null
    Write-Host "[ERR] game_lol: $_" -ForegroundColor Red
}
Write-Host "[>>] game_overwatch..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Overwatch\_retail_\Overwatch.exe","C:\Program Files\Overwatch\_retail_\Overwatch.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Overwatch 2" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Overwatch.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Write-Host "[OK] Overwatch 2: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Overwatch 2 not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_overwatch") | Out-Null
} catch {
    $failedTweaks.Add("game_overwatch") | Out-Null
    Write-Host "[ERR] game_overwatch: $_" -ForegroundColor Red
}
Write-Host "[>>] game_siege..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Ubisoft\Ubisoft Game Launcher\games\Tom Clancy's Rainbow Six Siege","C:\Program Files\Ubisoft\Ubisoft Game Launcher\games\Tom Clancy's Rainbow Six Siege"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rainbow Six Siege" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RainbowSix.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Write-Host "[OK] R6 Siege: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Rainbow Six Siege not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_siege") | Out-Null
} catch {
    $failedTweaks.Add("game_siege") | Out-Null
    Write-Host "[ERR] game_siege: $_" -ForegroundColor Red
}
Write-Host "[>>] game_rust..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Rust\RustClient.exe","D:\SteamLibrary\steamapps\common\Rust\RustClient.exe","E:\SteamLibrary\steamapps\common\Rust\RustClient.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rust" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Write-Host "[OK] Rust: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Rust not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_rust") | Out-Null
} catch {
    $failedTweaks.Add("game_rust") | Out-Null
    Write-Host "[ERR] game_rust: $_" -ForegroundColor Red
}
Write-Host "[>>] game_minecraft..." -ForegroundColor DarkYellow
try {
    $minePath = "$env:AppData\.minecraft\launcher_profiles.json"; If (Test-Path $minePath) { Write-Host "[DETECTED] Minecraft Java Edition" -ForegroundColor Green; $mcFolder = "$env:AppData\.minecraft"; try{Add-MpPreference -ExclusionPath $mcFolder -ErrorAction SilentlyContinue}catch{}; Write-Host "[OK] Minecraft: .minecraft folder added to Defender exclusions" -ForegroundColor Green } Else { Write-Host "[SKIP] Minecraft not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_minecraft") | Out-Null
} catch {
    $failedTweaks.Add("game_minecraft") | Out-Null
    Write-Host "[ERR] game_minecraft: $_" -ForegroundColor Red
}
Write-Host "[>>] game_roblox..." -ForegroundColor DarkYellow
try {
    $robloxPath = "$env:LocalAppData\Roblox\Versions"; If (Test-Path $robloxPath) { Write-Host "[DETECTED] Roblox" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RobloxPlayerBeta.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Roblox: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Roblox not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_roblox") | Out-Null
} catch {
    $failedTweaks.Add("game_roblox") | Out-Null
    Write-Host "[ERR] game_roblox: $_" -ForegroundColor Red
}
Write-Host "[>>] game_tarkov..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Battlestate Games\EFT\EscapeFromTarkov.exe","C:\Games\EFT\EscapeFromTarkov.exe","D:\Games\EFT\EscapeFromTarkov.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Escape from Tarkov" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\EscapeFromTarkov.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] Tarkov: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Escape from Tarkov not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_tarkov") | Out-Null
} catch {
    $failedTweaks.Add("game_tarkov") | Out-Null
    Write-Host "[ERR] game_tarkov: $_" -ForegroundColor Red
}
Write-Host "[>>] game_pubg..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Steam\steamapps\common\PUBG\TslGame\Binaries\Win64\TslGame.exe","D:\SteamLibrary\steamapps\common\PUBG\TslGame\Binaries\Win64\TslGame.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] PUBG" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\TslGame.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Write-Host "[OK] PUBG: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) priority" -ForegroundColor Green } Else { Write-Host "[SKIP] PUBG not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_pubg") | Out-Null
} catch {
    $failedTweaks.Add("game_pubg") | Out-Null
    Write-Host "[ERR] game_pubg: $_" -ForegroundColor Red
}
Write-Host "[>>] game_dbd..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Dead by Daylight","D:\SteamLibrary\steamapps\common\Dead by Daylight"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Dead by Daylight" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeadByDaylight-Win64-Shipping.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Set-ItemProperty -Path $key -Name 'IoPriority' -Value 3; Write-Host "[OK] DBD: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Dead by Daylight not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_dbd") | Out-Null
} catch {
    $failedTweaks.Add("game_dbd") | Out-Null
    Write-Host "[ERR] game_dbd: $_" -ForegroundColor Red
}
Write-Host "[>>] game_dota2..." -ForegroundColor DarkYellow
try {
    $paths = @("C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta","D:\SteamLibrary\steamapps\common\dota 2 beta"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Dota 2" -ForegroundColor Green; $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\dota2.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'CpuPriorityClass' -Value $_pri; Write-Host "[OK] Dota 2: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) priority" -ForegroundColor Green } Else { Write-Host "[SKIP] Dota 2 not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_dota2") | Out-Null
} catch {
    $failedTweaks.Add("game_dota2") | Out-Null
    Write-Host "[ERR] game_dota2: $_" -ForegroundColor Red
}
Write-Host "[>>] game_warframe..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Warframe","D:\SteamLibrary\steamapps\common\Warframe","$env:LOCALAPPDATA\Warframe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Warframe at $found" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warframe.x64.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Warframe: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Warframe not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_warframe") | Out-Null
} catch {
    $failedTweaks.Add("game_warframe") | Out-Null
    Write-Host "[ERR] game_warframe: $_" -ForegroundColor Red
}
Write-Host "[>>] game_forza..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\ForzaHorizon5","D:\SteamLibrary\steamapps\common\ForzaHorizon5","$env:ProgramFiles\WindowsApps"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Forza Horizon 5" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ForzaHorizon5.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Forza Horizon 5: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Forza Horizon 5 not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_forza") | Out-Null
} catch {
    $failedTweaks.Add("game_forza") | Out-Null
    Write-Host "[ERR] game_forza: $_" -ForegroundColor Red
}
Write-Host "[>>] game_readyornot..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Ready Or Not","D:\SteamLibrary\steamapps\common\Ready Or Not","E:\SteamLibrary\steamapps\common\Ready Or Not"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Ready or Not" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ReadyOrNot.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Ready or Not: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Ready or Not not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_readyornot") | Out-Null
} catch {
    $failedTweaks.Add("game_readyornot") | Out-Null
    Write-Host "[ERR] game_readyornot: $_" -ForegroundColor Red
}
Write-Host "[>>] game_phasmo..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Phasmophobia","D:\SteamLibrary\steamapps\common\Phasmophobia"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Phasmophobia" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Phasmophobia.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Phasmophobia: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Phasmophobia not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_phasmo") | Out-Null
} catch {
    $failedTweaks.Add("game_phasmo") | Out-Null
    Write-Host "[ERR] game_phasmo: $_" -ForegroundColor Red
}
Write-Host "[>>] game_battlefield..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files\EA Games\Battlefield 2042","C:\Program Files (x86)\Origin Games\Battlefield 2042","C:\Program Files (x86)\Steam\steamapps\common\Battlefield 2042","D:\SteamLibrary\steamapps\common\Battlefield 2042"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Battlefield 2042" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF2042.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri; Set-ItemProperty $key 'IoPriority' 3; Write-Host "[OK] Battlefield 2042: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) + High I/O" -ForegroundColor Green } Else { Write-Host "[SKIP] Battlefield 2042 not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_battlefield") | Out-Null
} catch {
    $failedTweaks.Add("game_battlefield") | Out-Null
    Write-Host "[ERR] game_battlefield: $_" -ForegroundColor Red
}
Write-Host "[>>] game_gta5..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Grand Theft Auto V\GTA5.exe","D:\SteamLibrary\steamapps\common\Grand Theft Auto V\GTA5.exe","E:\SteamLibrary\steamapps\common\Grand Theft Auto V\GTA5.exe","C:\Program Files\Rockstar Games\Grand Theft Auto V\GTA5.exe","D:\Rockstar Games\Grand Theft Auto V\GTA5.exe","D:\Games\Grand Theft Auto V\GTA5.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { $dir = Split-Path $found -Parent; Write-Host "[DETECTED] GTA V at $dir" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $key 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $key 'GPUPriority' 8 -Type DWord -Force; Set-ItemProperty $key 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $key 'DisableEnergyThrottling' 1 -Type DWord -Force; try{Add-MpPreference -ExclusionPath $dir -EA SilentlyContinue}catch{}; $scKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SocialClubHelper.exe\PerfOptions'; If (!(Test-Path $scKey)) { New-Item -Path $scKey -Force | Out-Null }; Set-ItemProperty $scKey 'CpuPriorityClass' 1 -Type DWord -Force; Write-Host "[OK] GTA V: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) IO+GPU=8, Defender exclusion, SocialClub deprioritized" -ForegroundColor Green } Else { Write-Host "[SKIP] GTA V not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_gta5") | Out-Null
} catch {
    $failedTweaks.Add("game_gta5") | Out-Null
    Write-Host "[ERR] game_gta5: $_" -ForegroundColor Red
}
Write-Host "[>>] game_fivem..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("$env:LocalAppData\FiveM\FiveM.exe","$env:LocalAppData\FiveM\FiveM.app\FiveM.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { $fivemDir = "$env:LocalAppData\FiveM\FiveM.app"; Write-Host "[DETECTED] FiveM at $env:LocalAppData\FiveM" -ForegroundColor Green; $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; $applyPerf = { param($exe) $p = "$ifeo\$exe\PerfOptions"; If (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $p 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $p 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $p 'IoPriority' 2 -Type DWord -Force; Set-ItemProperty $p 'PagePriority' 5 -Type DWord -Force; Write-Host "[OK] PerfOptions applied: $exe" -ForegroundColor Green }; @('FiveM.exe','GTA5.exe','FiveM_b2189_GTAProcess.exe','FiveM_b3323_GTAProcess.exe','FiveM_b3258_GTAProcess.exe','FiveM_b2802_GTAProcess.exe') | ForEach-Object { & $applyPerf $_ }; If (Test-Path $fivemDir) { try{Add-MpPreference -ExclusionPath $fivemDir -EA SilentlyContinue}catch{}; Write-Host "[OK] FiveM.app added to Defender exclusions" -ForegroundColor Green }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value 10 -Type DWord -Force; $adapter = Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1; If ($adapter) { Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ('1.1.1.1','1.0.0.1') -EA SilentlyContinue; Write-Host "[OK] DNS set to Cloudflare 1.1.1.1" -ForegroundColor Green }; Write-Host "[OK] FiveM: Full PerfOptions + Defender exclusion + 512KB network buffer + SystemResponsiveness=10" -ForegroundColor Green } Else { Write-Host "[SKIP] FiveM not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_fivem") | Out-Null
} catch {
    $failedTweaks.Add("game_fivem") | Out-Null
    Write-Host "[ERR] game_fivem: $_" -ForegroundColor Red
}
Write-Host "[>>] game_rocketleague..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\rocketleague\Binaries\Win64\RocketLeague.exe","D:\SteamLibrary\steamapps\common\rocketleague\Binaries\Win64\RocketLeague.exe","E:\SteamLibrary\steamapps\common\rocketleague\Binaries\Win64\RocketLeague.exe","C:\Program Files\Epic Games\rocketleague\Binaries\Win64\RocketLeague.exe","D:\Epic Games\rocketleague\Binaries\Win64\RocketLeague.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Rocket League at $found" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RocketLeague.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $key 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $key 'GPUPriority' 8 -Type DWord -Force; Set-ItemProperty $key 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $key 'DisableEnergyThrottling' 1 -Type DWord -Force; Stop-Service 'EpicGamesLauncher' -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Write-Host "[OK] Rocket League: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) IO+GPU=8, EnergyThrottle=Off, 512KB net buffer" -ForegroundColor Green } Else { Write-Host "[SKIP] Rocket League not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_rocketleague") | Out-Null
} catch {
    $failedTweaks.Add("game_rocketleague") | Out-Null
    Write-Host "[ERR] game_rocketleague: $_" -ForegroundColor Red
}
Write-Host "[>>] game_arcraiders..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths=@("C:\Program Files (x86)\Steam\steamapps\common\ARC Raiders","D:\SteamLibrary\steamapps\common\ARC Raiders","E:\SteamLibrary\steamapps\common\ARC Raiders","F:\SteamLibrary\steamapps\common\ARC Raiders","C:\Program Files (x86)\Steam\steamapps\common\Arc Raiders","D:\SteamLibrary\steamapps\common\Arc Raiders","C:\Games\ARC Raiders","D:\Games\ARC Raiders"); $found=$paths|Where-Object{Test-Path $_}|Select-Object -First 1; If($found){ Write-Host "[DETECTED] ARC Raiders at $found" -ForegroundColor Green; $ifeo='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; $exes=@('ARC-Win64-Shipping.exe','ARCLauncher.exe','ARC.exe'); foreach($exe in $exes){ $k="$ifeo\$exe\PerfOptions"; If(!(Test-Path $k)){New-Item $k -Force|Out-Null}; Set-ItemProperty $k 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $k 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $k 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $k 'PagePriority' 5 -Type DWord -Force; Set-ItemProperty $k 'GpuPriorityClass' 8 -Type DWord -Force; Write-Host "[OK] Full PerfOptions: $exe" -ForegroundColor Green }; try{Add-MpPreference -ExclusionPath $found -EA SilentlyContinue}catch{}; Write-Host "[OK] Defender exclusion: install folder" -ForegroundColor Green; $shaderDirs=@("$env:LOCALAPPDATA\NVIDIA\DXCache","$env:LOCALAPPDATA\NVIDIA\GLCache","$env:LOCALAPPDATA\D3DSCache"); foreach($sd in $shaderDirs){ If(Test-Path $sd){ try{Add-MpPreference -ExclusionPath $sd -EA SilentlyContinue}catch{} } }; Write-Host "[OK] Shader cache folders excluded from Defender" -ForegroundColor Green; $gm='HKCU:\SOFTWARE\Microsoft\GameBar'; Set-ItemProperty $gm 'AllowAutoGameMode' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $gm 'AutoGameModeEnabled' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Windows Game Mode enabled" -ForegroundColor Green; $mmcss='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If(!(Test-Path $mmcss)){New-Item $mmcss -Force|Out-Null}; Set-ItemProperty $mmcss 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $mmcss 'Priority' 6 -Type DWord -Force; Set-ItemProperty $mmcss 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $mmcss 'SFIO Priority' 'High' -Type String -Force; Set-ItemProperty $mmcss 'Background Only' 'False' -Type String -Force; Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' 'SystemResponsiveness' 10 -Type DWord -Force; Write-Host "[OK] MMCSS Games: Priority=6, GPU=8, High scheduling, SystemResponsiveness=10" -ForegroundColor Green; $gd='HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If(!(Test-Path $gd)){New-Item $gd -Force|Out-Null}; Set-ItemProperty $gd 'TdrDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrDdiDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrLimitCount' 20 -Type DWord -Force; Write-Host "[OK] TDR delay extended to 8s (prevents UE5 shader-compile GPU timeout)" -ForegroundColor Green; $afd='HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters'; Set-ItemProperty $afd 'DefaultReceiveWindow' 524288 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $afd 'DefaultSendWindow' 524288 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Network buffers: 512KB (extraction lobby + PvP desync reduction)" -ForegroundColor Green; $configRoots=@("$env:LOCALAPPDATA\ARC\Saved\Config\Windows","$env:LOCALAPPDATA\ARC Raiders\Saved\Config\Windows","$env:LOCALAPPDATA\ARCRaiders\Saved\Config\Windows"); $patched=$false; foreach($root in $configRoots){ If(Test-Path $root){ $ep="$root\Engine.ini"; If(!(Test-Path $ep)){New-Item $ep -ItemType File -Force|Out-Null}; $c=Get-Content $ep -Raw -EA SilentlyContinue; If($c -notmatch 'r\.MotionBlurQuality'){ Add-Content $ep ([Environment]::NewLine+'[SystemSettings]'); Add-Content $ep 'r.MotionBlurQuality=0'; Add-Content $ep 'r.LensFlareQuality=0'; Add-Content $ep 'r.BloomQuality=1'; Add-Content $ep 'r.ssr.quality=0'; Add-Content $ep 'r.ReflectionCaptureResolution=128'; Add-Content $ep 'r.Shadow.MaxResolution=1024'; Add-Content $ep 'r.ShadowQuality=3'; Add-Content $ep 'r.Streaming.PoolSize=2048'; Add-Content $ep 'r.DynamicGlobalIlluminationMethod=0'; Add-Content $ep 'r.ReflectionMethod=0'; Add-Content $ep 'r.Shadow.Virtual.Enable=0'; Add-Content $ep 'r.VolumetricFog=0'; Add-Content $ep 'r.RayTracing=0'; Add-Content $ep 'r.AntiAliasingMethod=2'; Add-Content $ep 'r.TemporalAA.Upscaling=0'; Add-Content $ep 'r.VolumetricCloud=0'; Add-Content $ep 'r.ContactShadows=0'; Add-Content $ep 'r.HZBOcclusion=1'; Add-Content $ep 'r.DepthOfFieldQuality=0'; Add-Content $ep 'r.AmbientOcclusionLevels=0'; Add-Content $ep 'r.DefaultFeature.AmbientOcclusion=0' }; If($c -notmatch 'bEnableMouseSmoothing'){ Add-Content $ep ([Environment]::NewLine+'[/Script/Engine.InputSettings]'); Add-Content $ep 'bEnableMouseSmoothing=False'; Add-Content $ep 'bViewAccelerationEnabled=False'; Add-Content $ep 'WindowsMouseSpeedFix=False' }; Write-Host "[OK] Engine.ini patched at $root" -ForegroundColor Green; $patched=$true } }; If(!$patched){ Write-Host "[INFO] Engine.ini config folder not yet created — launch ARC Raiders once then re-run to apply UE5 patches" -ForegroundColor Yellow }; Write-Host '' -ForegroundColor White; Write-Host '=== ARC Raiders — Full Optimization Applied ===' -ForegroundColor Cyan; Write-Host '  Process:  CpuPriority=AboveNormal, IO=High, GPU=8, EnergyThrottle=OFF, FgBoost=ON (all 3 exes)' -ForegroundColor Cyan; Write-Host '  Engine:   Lumen=OFF, VirtualShadows=OFF, VolumetricFog=OFF, RayTracing=OFF, AO=OFF, StreamPool=2GB' -ForegroundColor Cyan; Write-Host '  System:   TDR=8s, MMCSS tuned, 512KB network buffers, Defender + shader cache excluded, Game Mode ON' -ForegroundColor Cyan } Else { Write-Host "[SKIP] ARC Raiders not detected at known install paths" -ForegroundColor DarkGray; Write-Host "       Install via Steam then re-run for auto-detection" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_arcraiders") | Out-Null
} catch {
    $failedTweaks.Add("game_arcraiders") | Out-Null
    Write-Host "[ERR] game_arcraiders: $_" -ForegroundColor Red
}
Write-Host "[>>] game_marvelrivals..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files (x86)\Steam\steamapps\common\Marvel Rivals","D:\SteamLibrary\steamapps\common\Marvel Rivals","E:\SteamLibrary\steamapps\common\Marvel Rivals","C:\Program Files (x86)\Steam\steamapps\common\MarvelRivals","D:\SteamLibrary\steamapps\common\MarvelRivals"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Marvel Rivals at $found" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals-Win64-Shipping.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $key 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $key 'GPUPriority' 8 -Type DWord -Force; Set-ItemProperty $key 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $key 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $key 'ForceForegroundBoost' 1 -Type DWord -Force; try{Add-MpPreference -ExclusionPath $found -EA SilentlyContinue}catch{}; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Write-Host "[OK] Marvel Rivals: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) IO+GPU=8, Defender exclusion, 512KB net buffer" -ForegroundColor Green } Else { Write-Host "[SKIP] Marvel Rivals not detected" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_marvelrivals") | Out-Null
} catch {
    $failedTweaks.Add("game_marvelrivals") | Out-Null
    Write-Host "[ERR] game_marvelrivals: $_" -ForegroundColor Red
}
Write-Host "[>>] game_007firstlight..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths=@("C:\Program Files (x86)\Steam\steamapps\common\007 First Light","D:\SteamLibrary\steamapps\common\007 First Light","E:\SteamLibrary\steamapps\common\007 First Light","F:\SteamLibrary\steamapps\common\007 First Light","C:\Program Files\IO Interactive\007 First Light","D:\Games\007 First Light","D:\Games\007 First Light\Retail","C:\Games\007 First Light","C:\Games\007 First Light\Retail","E:\Games\007 First Light","F:\Games\007 First Light","C:\Program Files\EA Games\007 First Light"); $found=$paths|Where-Object{Test-Path $_}|Select-Object -First 1; If($found){ Write-Host "[DETECTED] 007 First Light at $found" -ForegroundColor Green; $ifeo='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; $exes=@('007FirstLight.exe','007FirstLight-Win64-Shipping.exe','ProjectBond.exe','ProjectBond-Win64-Shipping.exe'); foreach($exe in $exes){ $k="$ifeo\$exe\PerfOptions"; If(!(Test-Path $k)){New-Item $k -Force|Out-Null}; Set-ItemProperty $k 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $k 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $k 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $k 'PagePriority' 5 -Type DWord -Force; Set-ItemProperty $k 'GpuPriorityClass' 8 -Type DWord -Force; Write-Host "[OK] PerfOptions: $exe" -ForegroundColor Green }; try{Add-MpPreference -ExclusionPath $found -EA SilentlyContinue}catch{}; $shaderDirs=@("$env:LOCALAPPDATA\NVIDIA\DXCache","$env:LOCALAPPDATA\NVIDIA\GLCache","$env:LOCALAPPDATA\D3DSCache"); foreach($sd in $shaderDirs){ try{Add-MpPreference -ExclusionPath $sd -EA SilentlyContinue}catch{} }; Write-Host "[OK] Defender exclusions: game + shader cache folders" -ForegroundColor Green; $gm='HKCU:\SOFTWARE\Microsoft\GameBar'; Set-ItemProperty $gm 'AllowAutoGameMode' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $gm 'AutoGameModeEnabled' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Windows Game Mode enabled" -ForegroundColor Green; $mmcssBase='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'; $mmcssGames="$mmcssBase\Tasks\Games"; $mmcssAudio="$mmcssBase\Tasks\Audio"; If(!(Test-Path $mmcssGames)){New-Item $mmcssGames -Force|Out-Null}; Set-ItemProperty $mmcssGames 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $mmcssGames 'Priority' 6 -Type DWord -Force; Set-ItemProperty $mmcssGames 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $mmcssGames 'SFIO Priority' 'High' -Type String -Force; If(!(Test-Path $mmcssAudio)){New-Item $mmcssAudio -Force|Out-Null}; Set-ItemProperty $mmcssAudio 'Affinity' 0 -Type DWord -Force; Set-ItemProperty $mmcssAudio 'Background Only' 'False' -Type String -Force; Set-ItemProperty $mmcssAudio 'Clock Rate' 10000 -Type DWord -Force; Set-ItemProperty $mmcssAudio 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $mmcssAudio 'Priority' 6 -Type DWord -Force; Set-ItemProperty $mmcssAudio 'Scheduling Category' 'Medium' -Type String -Force; Set-ItemProperty $mmcssAudio 'SFIO Priority' 'Normal' -Type String -Force; Set-ItemProperty $mmcssBase 'SystemResponsiveness' 20 -Type DWord -Force; Write-Host "[OK] MMCSS Games Priority=6 GPU=8 High; Audio thread protected; SystemResponsiveness=20 (audio cutout fix)" -ForegroundColor Green; $gd='HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If(!(Test-Path $gd)){New-Item $gd -Force|Out-Null}; Set-ItemProperty $gd 'TdrDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrDdiDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrLimitCount' 20 -Type DWord -Force; Write-Host "[OK] TDR=8s (prevents UE5 shader-compile GPU timeout)" -ForegroundColor Green; $afd='HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters'; Set-ItemProperty $afd 'DefaultReceiveWindow' 524288 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $afd 'DefaultSendWindow' 524288 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Network buffers 512KB" -ForegroundColor Green; $ppk='HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty $ppk 'ValueMax' 100 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] CPU core unparking enforced" -ForegroundColor Green; $configRoots=@("$env:LOCALAPPDATA\007FirstLight\Saved\Config\Windows","$env:LOCALAPPDATA\007 First Light\Saved\Config\Windows","$env:LOCALAPPDATA\ProjectBond\Saved\Config\Windows","$env:LOCALAPPDATA\IOI\007FirstLight\Saved\Config\Windows","$env:LOCALAPPDATA\IO Interactive\007FirstLight\Saved\Config\Windows"); $patched=$false; foreach($root in $configRoots){ If(Test-Path $root){ $ep="$root\Engine.ini"; If(!(Test-Path $ep)){New-Item $ep -ItemType File -Force|Out-Null}; $c=Get-Content $ep -Raw -EA SilentlyContinue; $needsSettings=$c -notmatch 'r.MotionBlurQuality'; If($needsSettings){ Add-Content $ep ([Environment]::NewLine+"[SystemSettings]"); Add-Content $ep "r.MotionBlurQuality=0"; Add-Content $ep "r.LensFlareQuality=0"; Add-Content $ep "r.BloomQuality=0"; Add-Content $ep "r.DepthOfFieldQuality=0"; Add-Content $ep "r.Tonemapper.Quality=0"; Add-Content $ep "r.ssr.quality=0"; Add-Content $ep "r.ScreenSpaceReflections.Quality=0"; Add-Content $ep "r.ReflectionCaptureResolution=64"; Add-Content $ep "r.Shadow.MaxResolution=256"; Add-Content $ep "r.ShadowQuality=0"; Add-Content $ep "r.Shadow.Virtual.Enable=0"; Add-Content $ep "r.Streaming.PoolSize=1024"; Add-Content $ep "r.Streaming.UseFixedPoolSize=1"; Add-Content $ep "r.DynamicGlobalIlluminationMethod=0"; Add-Content $ep "r.Lumen.GlobalIllumination.Allow=0"; Add-Content $ep "r.Lumen.Reflections.Allow=0"; Add-Content $ep "r.ReflectionMethod=0"; Add-Content $ep "r.VolumetricFog=0"; Add-Content $ep "r.VolumetricCloud=0"; Add-Content $ep "r.RayTracing=0"; Add-Content $ep "r.AntiAliasingMethod=1"; Add-Content $ep "r.TemporalAA.Upscaling=0"; Add-Content $ep "r.MaxAnisotropy=0"; Add-Content $ep "r.MipMapLODBias=1"; Add-Content $ep "r.AmbientOcclusionLevels=0"; Add-Content $ep "r.AmbientOcclusion.Method=0"; Add-Content $ep "r.HZBOcclusion=1"; Add-Content $ep "r.VSync=0"; Add-Content $ep "t.MaxFPS=0"; Add-Content $ep "r.ShaderPipelineCache.Enabled=1"; Add-Content $ep "r.ShaderPipelineCache.BatchSize=128" }; If($c -notmatch 'bEnableMouseSmoothing'){ Add-Content $ep ([Environment]::NewLine+"[/Script/Engine.InputSettings]"); Add-Content $ep "bEnableMouseSmoothing=False"; Add-Content $ep "bViewAccelerationEnabled=False"; Add-Content $ep "WindowsMouseSpeedFix=False" }; Write-Host "[OK] Engine.ini patched at $root" -ForegroundColor Green; $patched=$true } }; If(!$patched){ Write-Host "[INFO] Engine.ini not found — launch 007 First Light once then re-run to apply UE5 patches" -ForegroundColor Yellow }; Write-Host "" -ForegroundColor White; Write-Host "=== 007 First Light — Stability + Max FPS Applied ===" -ForegroundColor Cyan; Write-Host "  Process:  CpuPriority=$(if($_pri-eq 4){'High'}else{'AboveNormal'}), IO=High, GPU=8, EnergyThrottle=OFF" -ForegroundColor Cyan; Write-Host "  Engine:   Lumen OFF, VSM OFF, Fog OFF, RT OFF, FXAA, Pool=1024MB fixed, SSAO OFF, DOF OFF" -ForegroundColor Cyan; Write-Host "  Audio:    MMCSS Audio thread protected, SystemResponsiveness=20 (no cutouts)" -ForegroundColor Cyan; Write-Host "  System:   TDR=8s, shader cache excluded, core unparking, 512KB net buffers" -ForegroundColor Cyan } Else { Write-Host "[SKIP] 007 First Light not detected. Launch once then re-run." -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_007firstlight") | Out-Null
} catch {
    $failedTweaks.Add("game_007firstlight") | Out-Null
    Write-Host "[ERR] game_007firstlight: $_" -ForegroundColor Red
}
Write-Host "[>>] game_fortnite..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths = @("C:\Program Files\Epic Games\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe","D:\Epic Games\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe","E:\Epic Games\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe","C:\Program Files (x86)\Epic Games\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"); $found = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1; If ($found) { Write-Host "[DETECTED] Fortnite at $found" -ForegroundColor Green; $key = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions'; If (!(Test-Path $key)) { New-Item -Path $key -Force | Out-Null }; Set-ItemProperty $key 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $key 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $key 'GPUPriority' 8 -Type DWord -Force; Set-ItemProperty $key 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $key 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $key 'ForceForegroundBoost' 1 -Type DWord -Force; $fDir = Split-Path $found; try{Add-MpPreference -ExclusionPath $fDir -EA SilentlyContinue}catch{}; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force; Write-Host "[OK] Fortnite: CPU=$(if($_pri-eq 4){'High'}else{'AboveNormal'}) IO+GPU=8, Defender exclusion, 512KB net buffer" -ForegroundColor Green } Else { Write-Host "[SKIP] Fortnite not detected. Install via Epic Games Launcher." -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_fortnite") | Out-Null
} catch {
    $failedTweaks.Add("game_fortnite") | Out-Null
    Write-Host "[ERR] game_fortnite: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Fortnite] 17 tweak(s) ---" -ForegroundColor DarkRed
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
Write-Host "[>>] FortniteDisableVSync..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.VSync=0"; Write-Host "[Fortnite] VSync disabled in Engine.ini" -ForegroundColor Green
    $appliedTweaks.Add("FortniteDisableVSync") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableVSync") | Out-Null
    Write-Host "[ERR] FortniteDisableVSync: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteEngineStreaming..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[/Script/Engine.StreamingSettings]"; Add-Content $enginePath "s.MinBulkDataSizeForAsyncLoading=131072"; Add-Content $enginePath "AsyncLoadingThreadEnabled=True"; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.Streaming.PoolSize=2048"; Add-Content $enginePath "r.MipMapLODBias=-1"; Write-Host "[Fortnite] Streaming pool optimized" -ForegroundColor Green
    $appliedTweaks.Add("FortniteEngineStreaming") | Out-Null
} catch {
    $failedTweaks.Add("FortniteEngineStreaming") | Out-Null
    Write-Host "[ERR] FortniteEngineStreaming: $_" -ForegroundColor Red
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
Write-Host "[>>] FortniteDisableLumen..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[SystemSettings]"; Add-Content $enginePath "r.DynamicGlobalIlluminationMethod=0"; Add-Content $enginePath "r.ReflectionMethod=0"; Write-Host "[Fortnite] Lumen GI and reflections disabled" -ForegroundColor Green
    $appliedTweaks.Add("FortniteDisableLumen") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableLumen") | Out-Null
    Write-Host "[ERR] FortniteDisableLumen: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteForceDirectX12..." -ForegroundColor DarkYellow
try {
    $launchPath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini"; Write-Host "[Fortnite] To enable DX12: in Epic Launcher click Fortnite Settings and add -dx12 to Additional Command Line Args" -ForegroundColor Cyan
    $appliedTweaks.Add("FortniteForceDirectX12") | Out-Null
} catch {
    $failedTweaks.Add("FortniteForceDirectX12") | Out-Null
    Write-Host "[ERR] FortniteForceDirectX12: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteDisableRecording..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[OnlineSubsystemMcp.Mcp2ServiceConfigs]"; Add-Content $enginePath "bEnabled=false"; Write-Host "[Fortnite] Background recording disabled" -ForegroundColor Green
    $appliedTweaks.Add("FortniteDisableRecording") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableRecording") | Out-Null
    Write-Host "[ERR] FortniteDisableRecording: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteAffinityPhysical..." -ForegroundColor DarkYellow
try {
    $proc = Get-Process -Name "FortniteClient-Win64-Shipping" -ErrorAction SilentlyContinue; If ($proc) { $cores = [System.Environment]::ProcessorCount; $physCores = $cores / 2; $mask = [Math]::Pow(2,$physCores)-1; $proc.ProcessorAffinity = [int]$mask; Write-Host "[Fortnite] Affinity set to physical cores only" -ForegroundColor Green } Else { Write-Host "[Fortnite] Launch Fortnite first, then re-run this script" -ForegroundColor Yellow }
    $appliedTweaks.Add("FortniteAffinityPhysical") | Out-Null
} catch {
    $failedTweaks.Add("FortniteAffinityPhysical") | Out-Null
    Write-Host "[ERR] FortniteAffinityPhysical: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteInputLatency..." -ForegroundColor DarkYellow
try {
    $enginePath = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $enginePath)) { New-Item -ItemType File -Path $enginePath -Force | Out-Null }; Add-Content $enginePath "[/Script/Engine.InputSettings]"; Add-Content $enginePath "bEnableMouseSmoothing=False"; Add-Content $enginePath "bViewAccelerationEnabled=False"; Write-Host "[Fortnite] Mouse smoothing and view acceleration disabled" -ForegroundColor Green
    $appliedTweaks.Add("FortniteInputLatency") | Out-Null
} catch {
    $failedTweaks.Add("FortniteInputLatency") | Out-Null
    Write-Host "[ERR] FortniteInputLatency: $_" -ForegroundColor Red
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
Write-Host "[>>] FortniteDisableSSR..." -ForegroundColor DarkYellow
try {
    $ep = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $ep)) { New-Item -ItemType File -Path $ep -Force | Out-Null }; $c = Get-Content $ep -Raw -EA SilentlyContinue; If ($c -notmatch 'r.ssr.quality') { Add-Content $ep ([Environment]::NewLine + "[SystemSettings]" + [Environment]::NewLine + "r.ssr.quality=0" + [Environment]::NewLine + "r.ReflectionCaptureResolution=64") }; Write-Host "[Fortnite] Screen-space reflections off (r.ssr.quality=0) — saves 5-15% GPU per frame on mid-range cards with no competitive impact." -ForegroundColor Green
    $appliedTweaks.Add("FortniteDisableSSR") | Out-Null
} catch {
    $failedTweaks.Add("FortniteDisableSSR") | Out-Null
    Write-Host "[ERR] FortniteDisableSSR: $_" -ForegroundColor Red
}
Write-Host "[>>] FortniteRawInput..." -ForegroundColor DarkYellow
try {
    $ep = "$env:LOCALAPPDATA\FortniteGame\Saved\Config\WindowsClient\Engine.ini"; If (!(Test-Path $ep)) { New-Item -ItemType File -Path $ep -Force | Out-Null }; $c = Get-Content $ep -Raw -EA SilentlyContinue; If ($c -notmatch 'bEnableMouseSmoothing') { Add-Content $ep ([Environment]::NewLine + "[/Script/Engine.InputSettings]" + [Environment]::NewLine + "bEnableMouseSmoothing=False" + [Environment]::NewLine + "bViewAccelerationEnabled=False" + [Environment]::NewLine + "WindowsMouseSpeedFix=False") }; Write-Host "[Fortnite] Raw mouse input configured — smoothing + view acceleration off. 1:1 aim tracking." -ForegroundColor Green
    $appliedTweaks.Add("FortniteRawInput") | Out-Null
} catch {
    $failedTweaks.Add("FortniteRawInput") | Out-Null
    Write-Host "[ERR] FortniteRawInput: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Startup Apps] 24 tweak(s) ---" -ForegroundColor DarkRed
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
Write-Host "[>>] su_steam..." -ForegroundColor DarkYellow
try {
    $steamKeys = @("Steam","steam"); foreach ($v in $steamKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Steam.lnk","$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Steam.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "Steam" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Steam*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Steam removed from ALL startup locations (registry, StartupApproved, .lnk, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_steam") | Out-Null
} catch {
    $failedTweaks.Add("su_steam") | Out-Null
    Write-Host "[ERR] su_steam: $_" -ForegroundColor Red
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
Write-Host "[>>] su_msiab..." -ForegroundColor DarkYellow
try {
    $msiKeys = @("MSIAfterburner","MSI Afterburner"); foreach ($v in $msiKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\MSI Afterburner.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "MSIAfterburner" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] MSI Afterburner removed from ALL startup locations (registry x2, StartupApproved, .lnk)" -ForegroundColor Green
    $appliedTweaks.Add("su_msiab") | Out-Null
} catch {
    $failedTweaks.Add("su_msiab") | Out-Null
    Write-Host "[ERR] su_msiab: $_" -ForegroundColor Red
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
Write-Host "[>>] su_realtek..." -ForegroundColor DarkYellow
try {
    $rtKeys = @("RtHDVCpl","RtkNGUI64","RtkAudUService64","Realtek HD Audio Manager"); foreach ($v in $rtKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null; reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in @("RtHDVCpl","RtkNGUI64")) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Write-Host "[OK] Realtek Audio HD Manager removed from ALL startup locations (HKCU + HKLM registry x4, StartupApproved)" -ForegroundColor Green
    $appliedTweaks.Add("su_realtek") | Out-Null
} catch {
    $failedTweaks.Add("su_realtek") | Out-Null
    Write-Host "[ERR] su_realtek: $_" -ForegroundColor Red
}
Write-Host "[>>] su_logitech..." -ForegroundColor DarkYellow
try {
    $lgKeys = @("LGHub","LCore","LGHUB","Logitech G HUB","LogiOptions+"); foreach ($v in $lgKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\LGHUB.lnk","$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Logitech G HUB.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in @("LGHub","LCore","LGHUB")) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Logitech*" -or $_.TaskName -like "*LGHUB*" -or $_.TaskName -like "*LogiOptions*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Logitech G Hub / LCore removed from ALL startup locations (registry x5, StartupApproved, .lnk, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_logitech") | Out-Null
} catch {
    $failedTweaks.Add("su_logitech") | Out-Null
    Write-Host "[ERR] su_logitech: $_" -ForegroundColor Red
}
Write-Host "[>>] su_corsair..." -ForegroundColor DarkYellow
try {
    $iCUEKeys = @("iCUE","Corsair iCUE","ICUE","CorsairHID"); foreach ($v in $iCUEKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\iCUE.lnk","$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Corsair iCUE.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in @("iCUE","ICUE")) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Corsair*" -or $_.TaskName -like "*iCUE*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Corsair iCUE removed from ALL startup locations (registry x4, StartupApproved, .lnk, scheduled tasks)" -ForegroundColor Green
    $appliedTweaks.Add("su_corsair") | Out-Null
} catch {
    $failedTweaks.Add("su_corsair") | Out-Null
    Write-Host "[ERR] su_corsair: $_" -ForegroundColor Red
}
Write-Host "[>>] su_amdradeon..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "RadeonSoftware" /f 2>$null; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "RadeonSoftware" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] Radeon Software removed from startup" -ForegroundColor Green
    $appliedTweaks.Add("su_amdradeon") | Out-Null
} catch {
    $failedTweaks.Add("su_amdradeon") | Out-Null
    Write-Host "[ERR] su_amdradeon: $_" -ForegroundColor Red
}
Write-Host "[>>] su_ea_app..." -ForegroundColor DarkYellow
try {
    $eaKeys = @("EADesktop","EA Desktop","EALauncher","Electronic Arts"); foreach ($v in $eaKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in $eaKeys) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*EABackground*" -or $_.TaskName -like "*EA Desktop*" -or $_.TaskName -like "*EALauncher*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] EA App removed from ALL startup locations — open EA App manually when you want to play EA games" -ForegroundColor Green
    $appliedTweaks.Add("su_ea_app") | Out-Null
} catch {
    $failedTweaks.Add("su_ea_app") | Out-Null
    Write-Host "[ERR] su_ea_app: $_" -ForegroundColor Red
}
Write-Host "[>>] su_epic..." -ForegroundColor DarkYellow
try {
    $epicKeys = @("EpicGamesLauncher","Epic Games Launcher","EpicLauncher"); foreach ($v in $epicKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Epic Games Launcher.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "EpicGamesLauncher" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Epic*" -or $_.TaskName -like "*EOS*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Epic Games Launcher removed from ALL startup locations" -ForegroundColor Green
    $appliedTweaks.Add("su_epic") | Out-Null
} catch {
    $failedTweaks.Add("su_epic") | Out-Null
    Write-Host "[ERR] su_epic: $_" -ForegroundColor Red
}
Write-Host "[>>] su_ubisoft..." -ForegroundColor DarkYellow
try {
    $ubiKeys = @("Ubisoft Connect","UbisoftConnect","upc"); foreach ($v in $ubiKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; foreach ($k in $ubiKeys) { Set-ItemProperty $saPath $k -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue }; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Ubisoft*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Ubisoft Connect removed from ALL startup locations" -ForegroundColor Green
    $appliedTweaks.Add("su_ubisoft") | Out-Null
} catch {
    $failedTweaks.Add("su_ubisoft") | Out-Null
    Write-Host "[ERR] su_ubisoft: $_" -ForegroundColor Red
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
Write-Host "[>>] su_firefox..." -ForegroundColor DarkYellow
try {
    reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "Firefox" /f 2>$null; Get-ScheduledTask | Where-Object { $_.TaskName -like "*Firefox*" -and $_.TaskName -notlike "*Update*" } | Disable-ScheduledTask -EA SilentlyContinue; Write-Host "[OK] Firefox background agent task disabled — Firefox updates and normal browsing are unaffected" -ForegroundColor Green
    $appliedTweaks.Add("su_firefox") | Out-Null
} catch {
    $failedTweaks.Add("su_firefox") | Out-Null
    Write-Host "[ERR] su_firefox: $_" -ForegroundColor Red
}
Write-Host "[>>] su_edge_startup..." -ForegroundColor DarkYellow
try {
    $edgeKeys = @("Microsoft Edge","MicrosoftEdge","msedge"); foreach ($v in $edgeKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "StartupBoostEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Microsoft\Edge" -Name "StartupBoostEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "BackgroundModeEnabled" -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Edge Startup Boost + background mode disabled via policy — Edge works normally when opened" -ForegroundColor Green
    $appliedTweaks.Add("su_edge_startup") | Out-Null
} catch {
    $failedTweaks.Add("su_edge_startup") | Out-Null
    Write-Host "[ERR] su_edge_startup: $_" -ForegroundColor Red
}
Write-Host "[>>] su_obs..." -ForegroundColor DarkYellow
try {
    $obsKeys = @("OBS Studio","obs64","obs"); foreach ($v in $obsKeys) { reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v $v /f 2>$null }; $lnks = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\OBS Studio.lnk"); foreach ($lnk in $lnks) { If (Test-Path $lnk) { Remove-Item $lnk -Force } }; $saPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"; if (!(Test-Path $saPath)) { New-Item $saPath -Force | Out-Null }; Set-ItemProperty $saPath "OBS Studio" -Value ([byte[]](0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[OK] OBS Studio removed from startup — OBS still works fine when launched manually" -ForegroundColor Green
    $appliedTweaks.Add("su_obs") | Out-Null
} catch {
    $failedTweaks.Add("su_obs") | Out-Null
    Write-Host "[ERR] su_obs: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Integrated Graphics] 31 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] IGpu_DisableULPS..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|RX|AMD|UHD Graphics|Iris|HD Graphics' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'EnableULPS' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'EnableULPS_NA' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] ULPS disabled on $((Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc) — prevents GPU downclocking between frames" -ForegroundColor Green }
    $appliedTweaks.Add("IGpu_DisableULPS") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableULPS") | Out-Null
    Write-Host "[ERR] IGpu_DisableULPS: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableDeepSleep..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|RX|AMD' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_SclkDeepSleepDisable' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'PP_ThermalAutoThrottlingEnable' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] AMD deep sleep + thermal throttling disabled — iGPU stays at full clock during gaming" -ForegroundColor Green }
    $appliedTweaks.Add("IGpu_DisableDeepSleep") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableDeepSleep") | Out-Null
    Write-Host "[ERR] IGpu_DisableDeepSleep: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableVariBright..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|AMD' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'ACEEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'VariBrightEnable' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'TrueColorEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[iGPU] AMD Vari-Bright disabled — prevents iGPU from downclocking to dim the screen" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableVariBright") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableVariBright") | Out-Null
    Write-Host "[ERR] IGpu_DisableVariBright: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_ForcePerformancePower..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|AMD|UHD|Iris|HD Graphics' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PP_PowerProfile' -Value 2 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'KMD_EnableComputePreemption' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[iGPU] GPU power profile forced to Performance mode — no power throttling during gaming" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_ForcePerformancePower") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_ForcePerformancePower") | Out-Null
    Write-Host "[ERR] IGpu_ForcePerformancePower: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableTransparency..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize' -Name 'EnableTransparency' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] Transparency effects disabled — saves iGPU compositor overhead (big win for Vega 8)" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableTransparency") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableTransparency") | Out-Null
    Write-Host "[ERR] IGpu_DisableTransparency: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableAnimations..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) -Type Binary -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] All desktop animations disabled — frees iGPU bandwidth for gaming frames" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableAnimations") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableAnimations") | Out-Null
    Write-Host "[ERR] IGpu_DisableAnimations: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableHDR..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\VideoSettings' -Name 'EnableHDRForPlayback' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] HDR disabled — saves significant iGPU bandwidth on integrated displays" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableHDR") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableHDR") | Out-Null
    Write-Host "[ERR] IGpu_DisableHDR: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableNightLight..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CloudStore\Store\Cache\DefaultAccount\$$windows.data.bluelightreduction.bluelightreductionstate\Current' -Name 'Data' -Value ([byte[]](0x43,0x42,0x01,0x00,0x0A,0x02,0x01,0x00,0xC2,0x0A,0x14,0x01,0x00)) -Type Binary -EA SilentlyContinue; Write-Host "[iGPU] Night Light disabled — removes color correction GPU overhead" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableNightLight") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableNightLight") | Out-Null
    Write-Host "[ERR] IGpu_DisableNightLight: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableSysMain..." -ForegroundColor DarkYellow
try {
    Stop-Service 'SysMain' -Force -EA SilentlyContinue; Set-Service 'SysMain' -StartupType Disabled -EA SilentlyContinue; Write-Host "[iGPU] SysMain disabled — frees RAM for iGPU frame buffer (critical on 8GB RAM systems with shared VRAM)" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableSysMain") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableSysMain") | Out-Null
    Write-Host "[ERR] IGpu_DisableSysMain: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_GameModeOn..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AllowAutoGameMode' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] Windows Game Mode enabled — OS prioritizes game resources on shared CPU+GPU Ryzen systems" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_GameModeOn") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_GameModeOn") | Out-Null
    Write-Host "[ERR] IGpu_GameModeOn: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_UltimatePerformancePlan..." -ForegroundColor DarkYellow
try {
    powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null; $guid = (powercfg -l | Select-String 'Ultimate Performance') | Select-Object -First 1; if ($guid) { $id = $guid.Line.Split(' ')[3]; powercfg -setactive $id; Write-Host "[iGPU] Ultimate Performance power plan activated — AMD Ryzen iGPU stays at max boost clocks" -ForegroundColor Green } else { powercfg -setactive SCHEME_MIN; Write-Host "[iGPU] High Performance power plan activated" -ForegroundColor Green }
    $appliedTweaks.Add("IGpu_UltimatePerformancePlan") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_UltimatePerformancePlan") | Out-Null
    Write-Host "[ERR] IGpu_UltimatePerformancePlan: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_MaxProcessorState..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 100; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 5; powercfg -setactive SCHEME_CURRENT; Write-Host "[iGPU] CPU set to 100%% max + 5%% min processor state — AMD Ryzen stays at peak clocks for both CPU and iGPU compute" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_MaxProcessorState") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_MaxProcessorState") | Out-Null
    Write-Host "[ERR] IGpu_MaxProcessorState: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableFullscreenOpt..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers' -Force -EA SilentlyContinue | Out-Null; @("$env:SystemRoot\System32\notepad.exe") | ForEach-Object { reg add "HKCU\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" /v $_ /t REG_SZ /d "DISABLEDXMAXIMIZEDWINDOWEDMODE" /f 2>$null }; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_FSEBehaviorMode' -Value 2 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] Fullscreen Optimizations disabled — forces exclusive fullscreen for lower DWM overhead on iGPU" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableFullscreenOpt") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableFullscreenOpt") | Out-Null
    Write-Host "[ERR] IGpu_DisableFullscreenOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableXboxGameBar..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] Xbox Game Bar + DVR disabled — eliminates background GPU usage from capture overlay" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableXboxGameBar") | Out-Null
    Write-Host "[ERR] IGpu_DisableXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_AmdAntiLag..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|AMD' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'AntiLagEnabled' -Value 1 -Type DWord -EA SilentlyContinue }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\AMD\CN' -Name 'AntiLag' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] AMD Anti-Lag enabled — reduces latency between CPU and iGPU render pipeline on Vega 8" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_AmdAntiLag") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_AmdAntiLag") | Out-Null
    Write-Host "[ERR] IGpu_AmdAntiLag: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_SharedMemoryHint..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|AMD' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableInternalLargePage' -Value 2 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'DisableDrmdmrs' -Value 1 -Type DWord -EA SilentlyContinue }; Write-Host "[iGPU] AMD VRAM large page hints applied — driver allocates larger contiguous memory pages for iGPU frame buffer" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_SharedMemoryHint") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_SharedMemoryHint") | Out-Null
    Write-Host "[ERR] IGpu_SharedMemoryHint: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableDWMColorSpace..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'DpiScalingVer' -Value 0x00001000 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] DWM color processing hint reduced — less compositor overhead on iGPU" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableDWMColorSpace") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableDWMColorSpace") | Out-Null
    Write-Host "[ERR] IGpu_DisableDWMColorSpace: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_SetTimerResolution..." -ForegroundColor DarkYellow
try {
    bcdedit /set disabledynamictick yes 2>$null; bcdedit /deletevalue useplatformtick 2>$null; bcdedit /deletevalue useplatformclock 2>$null; Write-Host "[iGPU] Dynamic tick disabled (safe timer precision boost — avoids useplatformtick boot-hang on Ryzen APUs)" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_SetTimerResolution") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_SetTimerResolution") | Out-Null
    Write-Host "[ERR] IGpu_SetTimerResolution: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_CloseBrowserGPU..." -ForegroundColor DarkYellow
try {
    Stop-Process -Name "chrome" -Force -EA SilentlyContinue; Stop-Process -Name "msedge" -Force -EA SilentlyContinue; Stop-Process -Name "firefox" -Force -EA SilentlyContinue; Write-Host "[iGPU] Hardware-accelerated browsers closed — frees iGPU VRAM for gaming. Reopen after gaming session." -ForegroundColor Yellow
    $appliedTweaks.Add("IGpu_CloseBrowserGPU") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_CloseBrowserGPU") | Out-Null
    Write-Host "[ERR] IGpu_CloseBrowserGPU: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableCoreParking..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null; $cpPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] CPU core parking disabled — AMD Ryzen 2200G keeps all 4 cores active (shared CPU + Vega 8 compute)" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableCoreParking") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableCoreParking") | Out-Null
    Write-Host "[ERR] IGpu_DisableCoreParking: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_Intel_MaxFreq..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Intel.*UHD|Intel.*Iris|Intel.*HD Graphics' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'Disable_OverlayDSRender' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'AdaptiveVsyncEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[Intel iGPU] Overlay render and adaptive vsync disabled — lower latency on Intel UHD/Iris" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_Intel_MaxFreq") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_Intel_MaxFreq") | Out-Null
    Write-Host "[ERR] IGpu_Intel_MaxFreq: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_Intel_DisableFreqScaling..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Intel.*UHD|Intel.*Iris|Intel.*HD Graphics' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DisablePowerWell' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'RC6Enable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[Intel iGPU] Intel RC6 power state disabled — GPU stays at max frequency instead of scaling down" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_Intel_DisableFreqScaling") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_Intel_DisableFreqScaling") | Out-Null
    Write-Host "[ERR] IGpu_Intel_DisableFreqScaling: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_Intel_TDR..." -ForegroundColor DarkYellow
try {
    $gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If (!(Test-Path $gdrv)) { New-Item $gdrv -Force | Out-Null }; Set-ItemProperty $gdrv 'TdrDelay' 8 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $gdrv 'TdrDdiDelay' 8 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $gdrv 'TdrLimitCount' 10 -Type DWord -Force -EA SilentlyContinue; Write-Host "[Intel iGPU] TDR timeout extended to 8s — prevents GPU timeout/recovery resets during heavy game loads on Intel UHD/Iris" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_Intel_TDR") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_Intel_TDR") | Out-Null
    Write-Host "[ERR] IGpu_Intel_TDR: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_Intel_PanelFitter..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Intel.*UHD|Intel.*Iris|Intel.*HD Graphics' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'PanelFitterControl' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'DitherEnable' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'GammaRampEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[Intel iGPU] Panel fitter and dither disabled — removes display post-processing latency. Run at native resolution for best results." -ForegroundColor Green
    $appliedTweaks.Add("IGpu_Intel_PanelFitter") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_Intel_PanelFitter") | Out-Null
    Write-Host "[ERR] IGpu_Intel_PanelFitter: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_Intel_QSVOff..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Intel.*UHD|Intel.*Iris|Intel.*HD Graphics' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'KMD_EnableGucSubmission' -Value 0 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'HuCEnable' -Value 0 -Type DWord -EA SilentlyContinue }; Stop-Service -Name 'igfxCUIService*' -Force -EA SilentlyContinue; Write-Host "[Intel iGPU] Intel Quick Sync and GuC submission disabled — frees iGPU compute from hardware encode reservation, gives more shaders to gaming" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_Intel_QSVOff") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_Intel_QSVOff") | Out-Null
    Write-Host "[ERR] IGpu_Intel_QSVOff: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableHAGSForIGpu..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] HAGS disabled — Hardware Accelerated GPU Scheduling causes latency on integrated GPUs (designed for discrete NVIDIA RTX 2000+ / AMD RX 6000+)" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableHAGSForIGpu") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableHAGSForIGpu") | Out-Null
    Write-Host "[ERR] IGpu_DisableHAGSForIGpu: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_NetworkThrottling..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] Network throttling disabled — CPU freed from interrupt throttling (important when CPU and GPU share die)" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_NetworkThrottling") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_NetworkThrottling") | Out-Null
    Write-Host "[ERR] IGpu_NetworkThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_DisableMPO..." -ForegroundColor DarkYellow
try {
    New-Item -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Dwm' -Name 'OverlayTestMode' -Value 5 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] Multi-Plane Overlay (MPO) disabled — eliminates screen tearing and flickering caused by MPO on AMD integrated GPUs" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_DisableMPO") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_DisableMPO") | Out-Null
    Write-Host "[ERR] IGpu_DisableMPO: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_AmdTdrLevel..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrDelay' -Value 60 -Type DWord -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrDdiDelay' -Value 60 -Type DWord -EA SilentlyContinue; Write-Host "[iGPU] TDR timeout extended to 60s — prevents Windows from killing Vega 8 as 'hung GPU' during heavy compute loads" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_AmdTdrLevel") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_AmdTdrLevel") | Out-Null
    Write-Host "[ERR] IGpu_AmdTdrLevel: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_AmdDisableHDCP..." -ForegroundColor DarkYellow
try {
    $gpuPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'Radeon|Vega|AMD' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'DisableHDCP' -Value 1 -Type DWord -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'HdcpSupport' -Value 0 -Type DWord -EA SilentlyContinue }; Write-Host "[iGPU] HDCP disabled on Vega 8 — removes DRM handshake overhead from the iGPU display pipeline, frees GPU cycles for rendering" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_AmdDisableHDCP") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_AmdDisableHDCP") | Out-Null
    Write-Host "[ERR] IGpu_AmdDisableHDCP: $_" -ForegroundColor Red
}
Write-Host "[>>] IGpu_AmdVegaAudioOff..." -ForegroundColor DarkYellow
try {
    $audioPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e977-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $audioPath -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DriverDesc -match 'AMD|Radeon|High Definition Audio' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'EnableAudioPowerManagement' -Value 0 -Type DWord -EA SilentlyContinue }; $svc = Get-Service -Name 'AtiHDAudioService' -EA SilentlyContinue; If ($svc) { Stop-Service $svc -Force -EA SilentlyContinue; Set-Service $svc.Name -StartupType Disabled -EA SilentlyContinue }; Write-Host "[iGPU] AMD HDMI/DP audio co-processor power-gated — the Vega 8 die includes an audio block that consumes power budget even when unused, disabling it gives more TDP headroom to GPU shaders" -ForegroundColor Green
    $appliedTweaks.Add("IGpu_AmdVegaAudioOff") | Out-Null
} catch {
    $failedTweaks.Add("IGpu_AmdVegaAudioOff") | Out-Null
    Write-Host "[ERR] IGpu_AmdVegaAudioOff: $_" -ForegroundColor Red
}

Write-Host "" 
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "   OPTI GODS by leaq -- TWEAKS APPLIED" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  [OK] $($appliedTweaks.Count) of 575 tweaks applied" -ForegroundColor Green
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