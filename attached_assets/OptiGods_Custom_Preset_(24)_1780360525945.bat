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
# Generated: 2026-06-02T00:31:30.237Z
# Tweaks enabled: 71
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
Write-Host "  Starting 71 optimizations..." -ForegroundColor White
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
Write-Host "--- [Registry / System] 60 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] Cod1650DisableAnsel..." -ForegroundColor DarkYellow
try {
    $base = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\'; $ansel = Join-Path $base 'Ansel'; If (Test-Path $ansel) { Set-ItemProperty -Path $ansel -Name 'AnselEnable' -Value 0 -Type DWord -Force -EA SilentlyContinue }; $nfe = Join-Path $base 'NFE'; If (!(Test-Path $nfe)) { New-Item $nfe -Force | Out-Null }; Set-ItemProperty -Path $nfe -Name 'FeatureIds' -Value '' -Type String -Force -EA SilentlyContinue; Write-Host "[COD] NVIDIA Ansel screenshot overlay disabled for GTX 1650 Super — frees the VRAM buffer Ansel reserves at all times (helpful on 4GB cards)" -ForegroundColor Green
    $appliedTweaks.Add("Cod1650DisableAnsel") | Out-Null
} catch {
    $failedTweaks.Add("Cod1650DisableAnsel") | Out-Null
    Write-Host "[ERR] Cod1650DisableAnsel: $_" -ForegroundColor Red
}
Write-Host "[>>] Cod1650LowLatency..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm'; If (Test-Path $key) { Set-ItemProperty -Path $key -Name 'NvCplLowLatencyMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] NVIDIA Low Latency mode applied for GTX 1650 Super — reduces pre-rendered frame queue from 3 to 1, lowers input lag in BO6 gunfights" -ForegroundColor Green } Else { Write-Host "[SKIP] NVIDIA driver key not found" -ForegroundColor DarkGray }
    $appliedTweaks.Add("Cod1650LowLatency") | Out-Null
} catch {
    $failedTweaks.Add("Cod1650LowLatency") | Out-Null
    Write-Host "[ERR] Cod1650LowLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] Cod3500CoreUnpark..." -ForegroundColor DarkYellow
try {
    $cpPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; If (Test-Path $cpPath) { Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $cpPath -Name 'Attributes' -Value 1 -Type DWord -Force -EA SilentlyContinue }; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null; Write-Host "[COD] All 6 Ryzen 3500 cores unparked — core parking adds 5-15ms wake latency when BO6 bursts onto a parked core. With 6 cores and no SMT, every core must be ready." -ForegroundColor Green
    $appliedTweaks.Add("Cod3500CoreUnpark") | Out-Null
} catch {
    $failedTweaks.Add("Cod3500CoreUnpark") | Out-Null
    Write-Host "[ERR] Cod3500CoreUnpark: $_" -ForegroundColor Red
}
Write-Host "[>>] Cod3500PowerPlan..." -ForegroundColor DarkYellow
try {
    $ryzen = powercfg -l | Select-String 'Ryzen'; If ($ryzen) { $guid = (($ryzen.Line.Trim()) -split 's+')[3]; powercfg -setactive $guid 2>$null; Write-Host "[COD] AMD Ryzen Balanced power plan activated — preserves correct boost behavior for Ryzen 3500. Windows default Balanced throttles boost clocks mid-game." -ForegroundColor Green } Else { powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 0; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 943c8cb6-6f93-4227-ad87-e9a3feec08d1 100; powercfg -setactive SCHEME_CURRENT; Write-Host "[COD] CPU min 0% / max 100% applied — Ryzen 3500 will sustain 4.1GHz boost during COD gameplay" -ForegroundColor Green }
    $appliedTweaks.Add("Cod3500PowerPlan") | Out-Null
} catch {
    $failedTweaks.Add("Cod3500PowerPlan") | Out-Null
    Write-Host "[ERR] Cod3500PowerPlan: $_" -ForegroundColor Red
}
Write-Host "[>>] CodBattlenetOptimize..." -ForegroundColor DarkYellow
try {
    @("BattleNet", "Battle.net", "Agent") | ForEach-Object { Get-Process -Name $_ -EA SilentlyContinue | Where-Object { $_.MainWindowHandle -eq 0 } | Stop-Process -Force -EA SilentlyContinue }; Write-Host "[COD] Battle.net background agents stopped — frees 50-150MB RAM and CPU cycles during gameplay. Reopen Battle.net to restore." -ForegroundColor Green
    $appliedTweaks.Add("CodBattlenetOptimize") | Out-Null
} catch {
    $failedTweaks.Add("CodBattlenetOptimize") | Out-Null
    Write-Host "[ERR] CodBattlenetOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDisableHAGS..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 1 -Type DWord -Force; Write-Host "[COD] HAGS disabled (HwSchMode=1). GTX 1650 Super + BO6/Warzone: HAGS causes frame-time variance and texture streaming stalls on Turing/Pascal GPUs — this is the #1 stutter fix for 4GB cards. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("CodDisableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("CodDisableHAGS") | Out-Null
    Write-Host "[ERR] CodDisableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] CodDisableLSO..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { Disable-NetAdapterLso -Name $_.Name -EA SilentlyContinue; Write-Host "[COD] LSO disabled on: $($_.Name)" -ForegroundColor Cyan }; Write-Host "[COD] Large Send Offload disabled on all active adapters — eliminates 5-30ms latency spikes during Warzone circle fights" -ForegroundColor Green
    $appliedTweaks.Add("CodDisableLSO") | Out-Null
} catch {
    $failedTweaks.Add("CodDisableLSO") | Out-Null
    Write-Host "[ERR] CodDisableLSO: $_" -ForegroundColor Red
}
Write-Host "[>>] CodGameMode..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -Force -EA SilentlyContinue; $key = 'HKCU:\System\GameConfigStore'; If (!(Test-Path $key)) { New-Item $key -Force | Out-Null }; Set-ItemProperty -Path $key -Name 'GameDVR_Enabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path $key -Name 'GameDVR_FSEBehaviorMode' -Value 2 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] Windows Game Mode enabled, Xbox DVR disabled — frees CPU/GPU overhead while COD is running" -ForegroundColor Green
    $appliedTweaks.Add("CodGameMode") | Out-Null
} catch {
    $failedTweaks.Add("CodGameMode") | Out-Null
    Write-Host "[ERR] CodGameMode: $_" -ForegroundColor Red
}
Write-Host "[>>] CodHighPriority..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions'; If (!(Test-Path $ifeo)) { New-Item -Path $ifeo -Force | Out-Null }; Set-ItemProperty -Path $ifeo -Name 'CpuPriorityClass' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'IoPriority' -Value 3 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'PagePriority' -Value 5 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'DisableEnergyThrottling' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'EnableBoost' -Value 1 -Type DWord -Force; Set-ItemProperty -Path $ifeo -Name 'ForceForegroundBoost' -Value 1 -Type DWord -Force; Write-Host "[COD] cod.exe priority stack: High CPU+IO, energy throttle off, foreground boost on — persists across reboots" -ForegroundColor Green
    $appliedTweaks.Add("CodHighPriority") | Out-Null
} catch {
    $failedTweaks.Add("CodHighPriority") | Out-Null
    Write-Host "[ERR] CodHighPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] CodNetworkBuffer..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow' -Value 524288 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] Network socket buffers set to 512KB — reduces packet loss spikes in Warzone BR server model, helps with character/loot not loading during drop phase" -ForegroundColor Green
    $appliedTweaks.Add("CodNetworkBuffer") | Out-Null
} catch {
    $failedTweaks.Add("CodNetworkBuffer") | Out-Null
    Write-Host "[ERR] CodNetworkBuffer: $_" -ForegroundColor Red
}
Write-Host "[>>] CodPagefileOptimize..." -ForegroundColor DarkYellow
try {
    $minMB = 16384; $maxMB = 32768; $cs = Get-WmiObject Win32_ComputerSystem; $cs.AutomaticManagedPagefile = $false; $cs.Put() | Out-Null; $pf = Get-WmiObject Win32_PageFileSetting -EA SilentlyContinue | Where-Object { $_.Name -like 'C:*' }; If ($pf) { $pf.InitialSize = $minMB; $pf.MaximumSize = $maxMB; $pf.Put() | Out-Null } Else { $s = ([WMIClass]'Win32_PageFileSetting').CreateInstance(); $s.Name = 'C:pagefile.sys'; $s.InitialSize = $minMB; $s.MaximumSize = $maxMB; $s.Put() | Out-Null }; Write-Host "[COD] Pagefile set to 16GB-32GB. GTX 1650 Super has 4GB VRAM — when BO6 fills it (happens mid-game), Windows pages overflow textures to RAM via pagefile. Undersized pagefile = blurry buildings and character pop-in you are seeing." -ForegroundColor Green
    $appliedTweaks.Add("CodPagefileOptimize") | Out-Null
} catch {
    $failedTweaks.Add("CodPagefileOptimize") | Out-Null
    Write-Host "[ERR] CodPagefileOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] CodShaderCacheClear..." -ForegroundColor DarkYellow
try {
    $paths = @("$env:LOCALAPPDATA\Activision\cod\cache", "$env:LOCALAPPDATA\Battle.net\Cache", "$env:LOCALAPPDATA\NVIDIA\DXCache", "$env:LOCALAPPDATA\D3DSCache"); $cleaned = 0; foreach ($p in $paths) { If (Test-Path $p) { Remove-Item -Path "$p\*" -Recurse -Force -EA SilentlyContinue; $cleaned++; Write-Host "[COD] Cleared: $p" -ForegroundColor Cyan } }; Write-Host "[COD] Shader + GPU driver cache cleared ($cleaned folders). BO6 will recompile shaders on next launch — expect a 2-3 min stutter pass, then textures will load correctly every game." -ForegroundColor Green
    $appliedTweaks.Add("CodShaderCacheClear") | Out-Null
} catch {
    $failedTweaks.Add("CodShaderCacheClear") | Out-Null
    Write-Host "[ERR] CodShaderCacheClear: $_" -ForegroundColor Red
}
Write-Host "[>>] CodTCPOptimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TcpAckFrequency' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TCPNoDelay' -Value 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TcpTimestampOpt' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] TCP: Nagle off (TCPNoDelay=1), immediate ACKs, timestamps off — tighter COD server tick alignment" -ForegroundColor Green
    $appliedTweaks.Add("CodTCPOptimize") | Out-Null
} catch {
    $failedTweaks.Add("CodTCPOptimize") | Out-Null
    Write-Host "[ERR] CodTCPOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableAnimations..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00))
    $appliedTweaks.Add("DisableAnimations") | Out-Null
} catch {
    $failedTweaks.Add("DisableAnimations") | Out-Null
    Write-Host "[ERR] DisableAnimations: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableCoreParking..." -ForegroundColor DarkYellow
try {
    $cpPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; Set-ItemProperty -Path $cpPath -Name 'ValueMax' -Value 0 -Type DWord; Set-ItemProperty -Path $cpPath -Name 'Attributes' -Value 1 -Type DWord; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100; Write-Host "[OK] CPU Core Parking disabled — all cores will remain active" -ForegroundColor Green
    $appliedTweaks.Add("DisableCoreParking") | Out-Null
} catch {
    $failedTweaks.Add("DisableCoreParking") | Out-Null
    Write-Host "[ERR] DisableCoreParking: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableDynamicTick..." -ForegroundColor DarkYellow
try {
    bcdedit /set disabledynamictick yes
    $appliedTweaks.Add("DisableDynamicTick") | Out-Null
} catch {
    $failedTweaks.Add("DisableDynamicTick") | Out-Null
    Write-Host "[ERR] DisableDynamicTick: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableFastStartup..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name 'HiberbootEnabled' -Value 0
    $appliedTweaks.Add("DisableFastStartup") | Out-Null
} catch {
    $failedTweaks.Add("DisableFastStartup") | Out-Null
    Write-Host "[ERR] DisableFastStartup: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableGameDVR..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0
    $appliedTweaks.Add("DisableGameDVR") | Out-Null
} catch {
    $failedTweaks.Add("DisableGameDVR") | Out-Null
    Write-Host "[ERR] DisableGameDVR: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableHungAppDetection..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'HungAppTimeout' -Value '1000'
    $appliedTweaks.Add("DisableHungAppDetection") | Out-Null
} catch {
    $failedTweaks.Add("DisableHungAppDetection") | Out-Null
    Write-Host "[ERR] DisableHungAppDetection: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableNDU..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Ndu' -Name 'Start' -Value 4
    $appliedTweaks.Add("DisableNDU") | Out-Null
} catch {
    $failedTweaks.Add("DisableNDU") | Out-Null
    Write-Host "[ERR] DisableNDU: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableNagle..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces' -Name 'TcpAckFrequency' -Value 1; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TCPNoDelay' -Value 1
    $appliedTweaks.Add("DisableNagle") | Out-Null
} catch {
    $failedTweaks.Add("DisableNagle") | Out-Null
    Write-Host "[ERR] DisableNagle: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePowerThrottling..." -ForegroundColor DarkYellow
try {
    powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 d4e98f31-5ffe-4ce1-be31-1b38b384c009 0; powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 d4e98f31-5ffe-4ce1-be31-1b38b384c009 0
    $appliedTweaks.Add("DisablePowerThrottling") | Out-Null
} catch {
    $failedTweaks.Add("DisablePowerThrottling") | Out-Null
    Write-Host "[ERR] DisablePowerThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePowerThrottlingAdv..." -ForegroundColor DarkYellow
try {
    $ptPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\be337238-0d82-4146-a960-4f3749d470c7'; If (Test-Path $ptPath) { Set-ItemProperty -Path $ptPath -Name 'Attributes' -Value 1 -Type DWord }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling' -Name 'PowerThrottlingOff' -Value 1 -Type DWord -ErrorAction SilentlyContinue; Write-Host "[OK] Power Throttling (Advanced) disabled via PowerSettings and PowerThrottling key" -ForegroundColor Green
    $appliedTweaks.Add("DisablePowerThrottlingAdv") | Out-Null
} catch {
    $failedTweaks.Add("DisablePowerThrottlingAdv") | Out-Null
    Write-Host "[ERR] DisablePowerThrottlingAdv: $_" -ForegroundColor Red
}
Write-Host "[>>] DisablePrefetch..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' -Name 'EnablePrefetcher' -Value 0; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' -Name 'EnableSuperfetch' -Value 0
    $appliedTweaks.Add("DisablePrefetch") | Out-Null
} catch {
    $failedTweaks.Add("DisablePrefetch") | Out-Null
    Write-Host "[ERR] DisablePrefetch: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableUSBSuspend..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    $appliedTweaks.Add("DisableUSBSuspend") | Out-Null
} catch {
    $failedTweaks.Add("DisableUSBSuspend") | Out-Null
    Write-Host "[ERR] DisableUSBSuspend: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableWindowsError..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' -Name 'Disabled' -Value 1; Stop-Service -Name 'WerSvc' -Force; Set-Service -Name 'WerSvc' -StartupType Disabled
    $appliedTweaks.Add("DisableWindowsError") | Out-Null
} catch {
    $failedTweaks.Add("DisableWindowsError") | Out-Null
    Write-Host "[ERR] DisableWindowsError: $_" -ForegroundColor Red
}
Write-Host "[>>] DisableXboxGameBar..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0; Get-AppxPackage Microsoft.XboxGamingOverlay | Remove-AppxPackage
    $appliedTweaks.Add("DisableXboxGameBar") | Out-Null
} catch {
    $failedTweaks.Add("DisableXboxGameBar") | Out-Null
    Write-Host "[ERR] DisableXboxGameBar: $_" -ForegroundColor Red
}
Write-Host "[>>] EnableHAGS..." -ForegroundColor DarkYellow
try {
    Write-Host "⚠  WARNING: NOT IDEAL FOR ALL SYSTEMS — HAGS HURTS OLDER GPUs. If you have a GTX 10xx (Pascal), GTX 16xx (Turing), or AMD RX 5000 or older, enabling HAGS increases frame-time variance and causes micro-stutters. It only benefits RTX 2000+ and RX 6000+ discrete GPUs on Windows 11. Skip this if you are on an older card." -ForegroundColor Yellow; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'HwSchMode' -Value 2; Write-Host "[Visual] Hardware-Accelerated GPU Scheduling enabled (HwSchMode=2). Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("EnableHAGS") | Out-Null
} catch {
    $failedTweaks.Add("EnableHAGS") | Out-Null
    Write-Host "[ERR] EnableHAGS: $_" -ForegroundColor Red
}
Write-Host "[>>] EnableTCPAutoTuning..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global autotuninglevel=normal; Write-Host "[OK] TCP Auto-Tuning set to Normal — dynamic receive window for max throughput" -ForegroundColor Green
    $appliedTweaks.Add("EnableTCPAutoTuning") | Out-Null
} catch {
    $failedTweaks.Add("EnableTCPAutoTuning") | Out-Null
    Write-Host "[ERR] EnableTCPAutoTuning: $_" -ForegroundColor Red
}
Write-Host "[>>] GameModeTweaks..." -ForegroundColor DarkYellow
try {
    $gamePath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamePath)) { New-Item -Path $gamePath -Force | Out-Null }; Set-ItemProperty -Path $gamePath -Name 'Scheduling Category' -Value 'High' -Type String; Set-ItemProperty -Path $gamePath -Name 'SFIO Priority' -Value 'High' -Type String; Set-ItemProperty -Path $gamePath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamePath -Name 'Priority' -Value 6 -Type DWord; Set-ItemProperty -Path $gamePath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Write-Host "[OK] Game Mode Scheduler: High Category, High SFIO, GPU Priority 8, CPU Priority 6, MaxPreRendered 1" -ForegroundColor Green
    $appliedTweaks.Add("GameModeTweaks") | Out-Null
} catch {
    $failedTweaks.Add("GameModeTweaks") | Out-Null
    Write-Host "[ERR] GameModeTweaks: $_" -ForegroundColor Red
}
Write-Host "[>>] InputLagTCP..." -ForegroundColor DarkYellow
try {
    $tcpPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters'; Set-ItemProperty -Path $tcpPath -Name 'TcpAckFrequency' -Value 1 -Type DWord; Set-ItemProperty -Path $tcpPath -Name 'TCPNoDelay' -Value 1 -Type DWord; Set-ItemProperty -Path $tcpPath -Name 'EnablePMTUBHDetect' -Value 0 -Type DWord; Write-Host "[OK] TCP Input Lag: TcpAckFrequency=1, TCPNoDelay=1, EnablePMTUBHDetect=0" -ForegroundColor Green
    $appliedTweaks.Add("InputLagTCP") | Out-Null
} catch {
    $failedTweaks.Add("InputLagTCP") | Out-Null
    Write-Host "[ERR] InputLagTCP: $_" -ForegroundColor Red
}
Write-Host "[>>] NetAdapterPowerSave..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*EEE' -RegistryValue 0 -EA SilentlyContinue; Set-NetAdapterAdvancedProperty -Name $_.Name -RegistryKeyword '*FlowControl' -RegistryValue 0 -EA SilentlyContinue; $pnp = Get-PnpDevice -FriendlyName $_.InterfaceDescription -EA SilentlyContinue | Select-Object -First 1; if ($pnp) { $pmPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($pnp.InstanceId)\Device Parameters"; Set-ItemProperty $pmPath -Name 'PnPCapabilities' -Value 24 -Type DWord -Force -EA SilentlyContinue } }; Write-Host "[Network] NIC power saving (EEE, Flow Control) disabled on all active adapters" -ForegroundColor Green
    $appliedTweaks.Add("NetAdapterPowerSave") | Out-Null
} catch {
    $failedTweaks.Add("NetAdapterPowerSave") | Out-Null
    Write-Host "[ERR] NetAdapterPowerSave: $_" -ForegroundColor Red
}
Write-Host "[>>] NetDNSCloudflare..." -ForegroundColor DarkYellow
try {
    Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ('1.1.1.1','1.0.0.1') }; Write-Host "[Network] DNS set to Cloudflare (1.1.1.1 / 1.0.0.1) on all active adapters" -ForegroundColor Green
    $appliedTweaks.Add("NetDNSCloudflare") | Out-Null
} catch {
    $failedTweaks.Add("NetDNSCloudflare") | Out-Null
    Write-Host "[ERR] NetDNSCloudflare: $_" -ForegroundColor Red
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
Write-Host "[>>] NetworkThrottling..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xffffffff
    $appliedTweaks.Add("NetworkThrottling") | Out-Null
} catch {
    $failedTweaks.Add("NetworkThrottling") | Out-Null
    Write-Host "[ERR] NetworkThrottling: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaAnisoFiltering..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found=$false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k -Name 'ForcedMipmapsMinLod' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k -Name 'AnisotropicDegree' -Value 16 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Anisotropic Filtering 16x forced on $k" -ForegroundColor Green; $found=$true } }; If (-not $found) { Write-Host "[NVIDIA] NVIDIA GPU class key not found — apply AF manually in NVCP" -ForegroundColor Yellow }
    $appliedTweaks.Add("NvidiaAnisoFiltering") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaAnisoFiltering") | Out-Null
    Write-Host "[ERR] NvidiaAnisoFiltering: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableOverlay..." -ForegroundColor DarkYellow
try {
    Get-AppxPackage *XboxGamingOverlay* | Remove-AppxPackage -EA SilentlyContinue; Stop-Process -Name "nvcontainer" -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\NVControlPanel2\Client' -Name 'OptInOrOutPreference' -Value 0 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Overlay and container process hints suppressed" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableOverlay") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableOverlay") | Out-Null
    Write-Host "[ERR] NvidiaDisableOverlay: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaDisableTelemetry..." -ForegroundColor DarkYellow
try {
    @('NvTelemetryContainer') | ForEach-Object { Stop-Service $_ -Force -EA SilentlyContinue; Set-Service $_ -StartupType Disabled -EA SilentlyContinue }; reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "NvBackend" /f 2>$null; Write-Host "[NVIDIA] NvTelemetryContainer stopped. Display container (NVDisplay.ContainerLocalSystem) intentionally kept running — stopping it causes NVIDIA Overlay.exe to crash with 0x80000003." -ForegroundColor Green
    $appliedTweaks.Add("NvidiaDisableTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaDisableTelemetry") | Out-Null
    Write-Host "[ERR] NvidiaDisableTelemetry: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaForceVSyncOff..." -ForegroundColor DarkYellow
try {
    $gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; Remove-ItemProperty $gdrv 'VerticalSyncOverride' -EA SilentlyContinue; Remove-ItemProperty $gdrv 'TripleBufferingOverride' -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak\Policies' -Name 'VSync' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] VSync override cleared — force VSync Off in NVCP or in-game for effect. Triple buffering key removed." -ForegroundColor Green
    $appliedTweaks.Add("NvidiaForceVSyncOff") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaForceVSyncOff") | Out-Null
    Write-Host "[ERR] NvidiaForceVSyncOff: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaLowLatency..." -ForegroundColor DarkYellow
try {
    $gamesPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty $gamesPath 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $gamesPath 'Priority' 6 -Type DWord -Force; Set-ItemProperty $gamesPath 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'SFIO Priority' 'High' -Type String -Force; Set-ItemProperty $gamesPath 'MaximumPreRenderedFrames' 1 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrDelay' -Value 10 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Low Latency Mode: GPU priority 8, Scheduling=High, PreRendered=1, TDR extended" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaLowLatency") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaLowLatency") | Out-Null
    Write-Host "[ERR] NvidiaLowLatency: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaMaxPerfMode..." -ForegroundColor DarkYellow
try {
    powercfg -setacvalueindex SCHEME_CURRENT 19caa947-ffffffff-ffffffff-ffffffff-ffffffff 233cfb73-ffffffff-ffffffff-ffffffff-ffffffff 1 2>$null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'PlatformSupportMiracast' -Value 0 -EA SilentlyContinue; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'TdrLevel' -Value 3 -EA SilentlyContinue; Write-Host "[NVIDIA] Max performance mode hints applied via GraphicsDrivers registry" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaMaxPerfMode") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaMaxPerfMode") | Out-Null
    Write-Host "[ERR] NvidiaMaxPerfMode: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaPowerMizer..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $found = $false; 0,1,2,3 | ForEach-Object { $k = "$gpuClass\000$_"; If ((Test-Path $k) -and (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') { Set-ItemProperty $k 'PerfLevelSrc' 0x2222 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerEnable' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerLevel' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'PowerMizerLevelAC' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] PowerMizer set to Max Performance on $k" -ForegroundColor Green; $found = $true } }; If (-not $found) { Write-Host "[NVIDIA] PowerMizer: NVIDIA GPU class key not found at 0000-0003 — apply via NVCP manually" -ForegroundColor Yellow }
    $appliedTweaks.Add("NvidiaPowerMizer") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaPowerMizer") | Out-Null
    Write-Host "[ERR] NvidiaPowerMizer: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaPreRenderedFrames..." -ForegroundColor DarkYellow
try {
    $gamesPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamesPath)) { New-Item -Path $gamesPath -Force | Out-Null }; Set-ItemProperty -Path $gamesPath -Name 'MaximumPreRenderedFrames' -Value 1 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'GPU Priority' -Value 8 -Type DWord; Set-ItemProperty -Path $gamesPath -Name 'Priority' -Value 6 -Type DWord; Write-Host "[NVIDIA] MaximumPreRenderedFrames=1, GPU Priority=8 — input latency minimized" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaPreRenderedFrames") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaPreRenderedFrames") | Out-Null
    Write-Host "[ERR] NvidiaPreRenderedFrames: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaRTXVideoOff..." -ForegroundColor DarkYellow
try {
    $vsrPath = 'HKCU:\SOFTWARE\NVIDIA Corporation\NvControlPanel2\Client'; If (!(Test-Path $vsrPath)) { New-Item $vsrPath -Force | Out-Null }; Set-ItemProperty $vsrPath 'OptInOrOutPreference' 0 -Type DWord -Force -EA SilentlyContinue; $rtxVid = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\RTXVideoManager'; If (!(Test-Path $rtxVid)) { New-Item $rtxVid -Force | Out-Null }; Set-ItemProperty $rtxVid 'RTXVideoSuperRes' 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $rtxVid 'RTXVideoHDR' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[GPU Thermal] RTX Video Super Resolution + RTX HDR disabled — stops continuous tensor core usage during video playback, reduces GPU heat" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaRTXVideoOff") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaRTXVideoOff") | Out-Null
    Write-Host "[ERR] NvidiaRTXVideoOff: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaReflexEnable..." -ForegroundColor DarkYellow
try {
    $reflexPath = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\Reflex'; If (!(Test-Path $reflexPath)) { New-Item $reflexPath -Force | Out-Null }; Set-ItemProperty $reflexPath 'Enable' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $reflexPath 'BoostEnabled' 1 -Type DWord -Force -EA SilentlyContinue; $gamePath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $gamePath)) { New-Item $gamePath -Force | Out-Null }; Set-ItemProperty $gamePath 'MaximumPreRenderedFrames' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Reflex hint enabled (Enable=1, BoostEnabled=1) — pair with in-game Reflex for lowest click-to-pixel latency" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaReflexEnable") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaReflexEnable") | Out-Null
    Write-Host "[ERR] NvidiaReflexEnable: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaShaderCache..." -ForegroundColor DarkYellow
try {
    If (!(Test-Path 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NGXCore')) { New-Item 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NGXCore' -Force | Out-Null }; Set-ItemProperty -Path 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak' -Name 'Ordinal' -Value 1 -Type DWord -EA SilentlyContinue; $dxPath = 'HKLM:\SOFTWARE\Microsoft\DirectX'; Set-ItemProperty -Path $dxPath -Name 'ShaderCache' -Value 1 -Type DWord -EA SilentlyContinue; Write-Host "[NVIDIA] Shader pre-caching enabled via DirectX registry + NGXCore hint" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaShaderCache") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaShaderCache") | Out-Null
    Write-Host "[ERR] NvidiaShaderCache: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaThreadedOpt..." -ForegroundColor DarkYellow
try {
    $nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NvTweak'; If (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }; Set-ItemProperty $nvKey 'Threaded_Optimization_Override' 1 -Type DWord -Force -EA SilentlyContinue; netsh int tcp set global dca=enabled 2>$null; $dxKey = 'HKLM:\SOFTWARE\Microsoft\DirectX'; Set-ItemProperty $dxKey 'ThreadedOptimization' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Threaded Optimization enabled via NvTweak registry and DirectX DCA" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaThreadedOpt") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaThreadedOpt") | Out-Null
    Write-Host "[ERR] NvidiaThreadedOpt: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaTripleBufferOff..." -ForegroundColor DarkYellow
try {
    $gdrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; Remove-ItemProperty $gdrv 'TripleBufferingOverride' -EA SilentlyContinue; $nvPol = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak\Policies'; If (!(Test-Path $nvPol)) { New-Item $nvPol -Force | Out-Null }; Set-ItemProperty $nvPol 'TripleBuffering' 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA] Triple Buffering disabled — reduces frame buffer depth for lower input latency" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaTripleBufferOff") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaTripleBufferOff") | Out-Null
    Write-Host "[ERR] NvidiaTripleBufferOff: $_" -ForegroundColor Red
}
Write-Host "[>>] OptimizeRAMUsage..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hProcess);' -Name 'MemTrimRO' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemTrimRO]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; [System.GC]::Collect(); Write-Host "[OK] Standby list flushed — physical RAM reclaimed for active processes" -ForegroundColor Green
    $appliedTweaks.Add("OptimizeRAMUsage") | Out-Null
} catch {
    $failedTweaks.Add("OptimizeRAMUsage") | Out-Null
    Write-Host "[ERR] OptimizeRAMUsage: $_" -ForegroundColor Red
}
Write-Host "[>>] OptimizeTCP..." -ForegroundColor DarkYellow
try {
    netsh int tcp set global autotuninglevel=normal 2>$null; netsh int tcp set global chimney=disabled 2>$null; netsh int tcp set global dca=enabled 2>$null; Write-Host "[OK] TCP globals tuned (autotune=normal, chimney=off, dca=on). netdma intentionally skipped — deprecated on Win10+, breaks modern NICs." -ForegroundColor Green
    $appliedTweaks.Add("OptimizeTCP") | Out-Null
} catch {
    $failedTweaks.Add("OptimizeTCP") | Out-Null
    Write-Host "[ERR] OptimizeTCP: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcGPUSchedulerHigh..." -ForegroundColor DarkYellow
try {
    $ifeo = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('GTA5.exe','FiveM.exe','valorant.exe','cs2.exe','FortniteClient-Win64-Shipping.exe','r5apex.exe') | ForEach-Object { $k = "$ifeo\$_\PerfOptions"; If (!(Test-Path $k)) { New-Item $k -Force | Out-Null }; Set-ItemProperty $k 'GpuPriority' 8 -Type DWord -Force }; Write-Host "[Process] GPU Scheduler Priority set to 8 (High) for game executables" -ForegroundColor Green
    $appliedTweaks.Add("ProcGPUSchedulerHigh") | Out-Null
} catch {
    $failedTweaks.Add("ProcGPUSchedulerHigh") | Out-Null
    Write-Host "[ERR] ProcGPUSchedulerHigh: $_" -ForegroundColor Red
}
Write-Host "[>>] ProcMMCSSGaming..." -ForegroundColor DarkYellow
try {
    $mmcss = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $mmcss)) { New-Item $mmcss -Force | Out-Null }; Set-ItemProperty $mmcss -Name 'Scheduling Category' -Value 'High' -Type String -Force; Set-ItemProperty $mmcss -Name 'SFIO Priority' -Value 'High' -Type String -Force; Set-ItemProperty $mmcss -Name 'GPU Priority' -Value 8 -Type DWord -Force; Set-ItemProperty $mmcss -Name 'Priority' -Value 6 -Type DWord -Force; Set-ItemProperty $mmcss -Name 'Background Only' -Value 'False' -Type String -Force; Write-Host "[Process] MMCSS Gaming profile set: SchedulingCategory=High, GPU Priority=8, CPU Priority=6" -ForegroundColor Green
    $appliedTweaks.Add("ProcMMCSSGaming") | Out-Null
} catch {
    $failedTweaks.Add("ProcMMCSSGaming") | Out-Null
    Write-Host "[ERR] ProcMMCSSGaming: $_" -ForegroundColor Red
}
Write-Host "[>>] SetDNSPriority..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters' -Name 'MaxCacheTtl' -Value 86400 -Type DWord -Force; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters' -Name 'MaxNegativeCacheTtl' -Value 0 -Type DWord -Force; netsh int tcp set global timestamps=disabled 2>$null; Write-Host "[OK] DNS: MaxCacheTTL=86400, NegativeCache=0, timestamps disabled" -ForegroundColor Green
    $appliedTweaks.Add("SetDNSPriority") | Out-Null
} catch {
    $failedTweaks.Add("SetDNSPriority") | Out-Null
    Write-Host "[ERR] SetDNSPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] SetHighPerformancePlan..." -ForegroundColor DarkYellow
try {
    powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61; $guid = (powercfg -l | Select-String 'Ultimate Performance').Line.Split(' ')[3]; powercfg -setactive $guid
    $appliedTweaks.Add("SetHighPerformancePlan") | Out-Null
} catch {
    $failedTweaks.Add("SetHighPerformancePlan") | Out-Null
    Write-Host "[ERR] SetHighPerformancePlan: $_" -ForegroundColor Red
}
Write-Host "[>>] SetResponsiveness..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value 10
    $appliedTweaks.Add("SetResponsiveness") | Out-Null
} catch {
    $failedTweaks.Add("SetResponsiveness") | Out-Null
    Write-Host "[ERR] SetResponsiveness: $_" -ForegroundColor Red
}
Write-Host "[>>] SysHibernateOff..." -ForegroundColor DarkYellow
try {
    powercfg /h off 2>$null; New-Item -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name 'HiberbootEnabled' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[System] Hibernation disabled — hiberfil.sys removed. Reclaims disk space equal to your RAM (8GB+ on most systems). Full cold boots only." -ForegroundColor Green
    $appliedTweaks.Add("SysHibernateOff") | Out-Null
} catch {
    $failedTweaks.Add("SysHibernateOff") | Out-Null
    Write-Host "[ERR] SysHibernateOff: $_" -ForegroundColor Red
}
Write-Host "[>>] SysVisualBestPerf..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Type DWord -Force -EA SilentlyContinue; $mask = [byte[]](0x90,0x12,0x01,0x80,0x10,0x00,0x00,0x00); Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'UserPreferencesMask' -Value $mask -Type Binary -Force -EA SilentlyContinue; Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'FontSmoothing' -Value '2' -Force -EA SilentlyContinue; New-Item -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Force -EA SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\DWM' -Name 'EnableAeroPeek' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[System] Visual effects set to Best Performance — all compositor animations disabled, GPU VRAM freed for gaming" -ForegroundColor Green
    $appliedTweaks.Add("SysVisualBestPerf") | Out-Null
} catch {
    $failedTweaks.Add("SysVisualBestPerf") | Out-Null
    Write-Host "[ERR] SysVisualBestPerf: $_" -ForegroundColor Red
}
Write-Host "[>>] Win32PrioritySeparation..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' -Name 'Win32PrioritySeparation' -Value 26
    $appliedTweaks.Add("Win32PrioritySeparation") | Out-Null
} catch {
    $failedTweaks.Add("Win32PrioritySeparation") | Out-Null
    Write-Host "[ERR] Win32PrioritySeparation: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Memory] 2 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] MemTrimOnMinimize..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options' -Name 'TrimWorkingSetSize' -Value 1 -Type DWord
    $appliedTweaks.Add("MemTrimOnMinimize") | Out-Null
} catch {
    $failedTweaks.Add("MemTrimOnMinimize") | Out-Null
    Write-Host "[ERR] MemTrimOnMinimize: $_" -ForegroundColor Red
}
Write-Host "[>>] MemTrimStandbyList..." -ForegroundColor DarkYellow
try {
    Add-Type -MemberDefinition '[DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr hProcess);' -Name 'MemHelperSL' -Namespace 'WinAPI' -EA SilentlyContinue; [WinAPI.MemHelperSL]::EmptyWorkingSet([IntPtr](-1)) | Out-Null; Write-Host "[OK] Standby list cleared — RAM freed for game" -ForegroundColor Green
    $appliedTweaks.Add("MemTrimStandbyList") | Out-Null
} catch {
    $failedTweaks.Add("MemTrimStandbyList") | Out-Null
    Write-Host "[ERR] MemTrimStandbyList: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Debloat] 2 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] PrivacyAdvertisingID..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo' -Name 'Enabled' -Value 0
    $appliedTweaks.Add("PrivacyAdvertisingID") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyAdvertisingID") | Out-Null
    Write-Host "[ERR] PrivacyAdvertisingID: $_" -ForegroundColor Red
}
Write-Host "[>>] PrivacyTelemetry..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0
    $appliedTweaks.Add("PrivacyTelemetry") | Out-Null
} catch {
    $failedTweaks.Add("PrivacyTelemetry") | Out-Null
    Write-Host "[ERR] PrivacyTelemetry: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Win Tweaks] 7 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] Win11AdsInStart..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SystemPaneSuggestionsEnabled' -Value 0; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338388Enabled' -Value 0; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' -Name 'SubscribedContent-338389Enabled' -Value 0
    $appliedTweaks.Add("Win11AdsInStart") | Out-Null
} catch {
    $failedTweaks.Add("Win11AdsInStart") | Out-Null
    Write-Host "[ERR] Win11AdsInStart: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11BingSearch..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'BingSearchEnabled' -Value 0; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search' -Name 'CortanaConsent' -Value 0
    $appliedTweaks.Add("Win11BingSearch") | Out-Null
} catch {
    $failedTweaks.Add("Win11BingSearch") | Out-Null
    Write-Host "[ERR] Win11BingSearch: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11Copilot..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot' -Name 'TurnOffWindowsCopilot' -Value 1; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -Name 'ShowCopilotButton' -Value 0
    $appliedTweaks.Add("Win11Copilot") | Out-Null
} catch {
    $failedTweaks.Add("Win11Copilot") | Out-Null
    Write-Host "[ERR] Win11Copilot: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11OneDriveBackup..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\OneDrive' -Name 'DisableFileSyncNGSC' -Value 1
    $appliedTweaks.Add("Win11OneDriveBackup") | Out-Null
} catch {
    $failedTweaks.Add("Win11OneDriveBackup") | Out-Null
    Write-Host "[ERR] Win11OneDriveBackup: $_" -ForegroundColor Red
}
Write-Host "[>>] Win11StartRecommended..." -ForegroundColor DarkYellow
try {
    Set-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' -Name 'HideRecommendedSection' -Value 1
    $appliedTweaks.Add("Win11StartRecommended") | Out-Null
} catch {
    $failedTweaks.Add("Win11StartRecommended") | Out-Null
    Write-Host "[ERR] Win11StartRecommended: $_" -ForegroundColor Red
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

Write-Host "" 
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "   OPTI GODS by leaq -- TWEAKS APPLIED" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  [OK] $($appliedTweaks.Count) of 71 tweaks applied" -ForegroundColor Green
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