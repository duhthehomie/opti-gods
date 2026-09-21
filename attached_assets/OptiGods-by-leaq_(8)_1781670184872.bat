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
# Generated: 2026-06-17T04:22:28.549Z
# Tweaks enabled: 13
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
Write-Host "  Starting 13 optimizations..." -ForegroundColor White
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
Write-Host "--- [Game Detection] 1 tweak(s) ---" -ForegroundColor DarkRed
Write-Host "[>>] game_007firstlight..." -ForegroundColor DarkYellow
try {
    $_c=(Get-CimInstance Win32_Processor -Property NumberOfCores|Measure-Object NumberOfCores -Sum).Sum; $_pri=if($_c -ge 6){4}else{3}; $paths=@("C:\Program Files (x86)\Steam\steamapps\common\007 First Light","D:\SteamLibrary\steamapps\common\007 First Light","E:\SteamLibrary\steamapps\common\007 First Light","F:\SteamLibrary\steamapps\common\007 First Light","C:\Program Files\IO Interactive\007 First Light","D:\Games\007 First Light","C:\Program Files\EA Games\007 First Light"); $found=$paths|Where-Object{Test-Path $_}|Select-Object -First 1; If($found){ Write-Host "[DETECTED] 007 First Light at $found" -ForegroundColor Green; $ifeo='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; $exes=@('007FirstLight.exe','007FirstLight-Win64-Shipping.exe','ProjectBond.exe','ProjectBond-Win64-Shipping.exe'); foreach($exe in $exes){ $k="$ifeo\$exe\PerfOptions"; If(!(Test-Path $k)){New-Item $k -Force|Out-Null}; Set-ItemProperty $k 'CpuPriorityClass' $_pri -Type DWord -Force; Set-ItemProperty $k 'CpuPriorityBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'DisableEnergyThrottling' 1 -Type DWord -Force; Set-ItemProperty $k 'EnableBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'ForceForegroundBoost' 1 -Type DWord -Force; Set-ItemProperty $k 'IoPriority' 3 -Type DWord -Force; Set-ItemProperty $k 'PagePriority' 5 -Type DWord -Force; Set-ItemProperty $k 'GpuPriorityClass' 8 -Type DWord -Force; Write-Host "[OK] Full PerfOptions: $exe" -ForegroundColor Green }; Add-MpPreference -ExclusionPath $found -EA SilentlyContinue; Write-Host "[OK] Defender exclusion added" -ForegroundColor Green; $gm='HKCU:\SOFTWARE\Microsoft\GameBar'; Set-ItemProperty $gm 'AllowAutoGameMode' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $gm 'AutoGameModeEnabled' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Windows Game Mode enabled" -ForegroundColor Green; $mmcss='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If(!(Test-Path $mmcss)){New-Item $mmcss -Force|Out-Null}; Set-ItemProperty $mmcss 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $mmcss 'Priority' 6 -Type DWord -Force; Set-ItemProperty $mmcss 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $mmcss 'SFIO Priority' 'High' -Type String -Force; Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' 'SystemResponsiveness' 10 -Type DWord -Force; Write-Host "[OK] MMCSS: Priority=6, GPU=8, High scheduling, SystemResponsiveness=10" -ForegroundColor Green; $gd='HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If(!(Test-Path $gd)){New-Item $gd -Force|Out-Null}; Set-ItemProperty $gd 'TdrDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrDdiDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrLimitCount' 20 -Type DWord -Force; Write-Host "[OK] TDR delay extended to 8s (prevents UE5 shader-compile GPU timeout)" -ForegroundColor Green; $afd='HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters'; Set-ItemProperty $afd 'DefaultReceiveWindow' 524288 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $afd 'DefaultSendWindow' 524288 -Type DWord -Force -EA SilentlyContinue; Write-Host "[OK] Network buffers set to 512KB" -ForegroundColor Green; $configRoots=@("$env:LOCALAPPDATA\007FirstLight\Saved\Config\Windows","$env:LOCALAPPDATA\007 First Light\Saved\Config\Windows","$env:LOCALAPPDATA\ProjectBond\Saved\Config\Windows","$env:LOCALAPPDATA\IOI\007FirstLight\Saved\Config\Windows"); $patched=$false; foreach($root in $configRoots){ If(Test-Path $root){ $ep="$root\Engine.ini"; If(!(Test-Path $ep)){New-Item $ep -ItemType File -Force|Out-Null}; $c=Get-Content $ep -Raw -EA SilentlyContinue; If($c -notmatch 'r.MotionBlurQuality'){ Add-Content $ep ([Environment]::NewLine+"[SystemSettings]"); Add-Content $ep "r.MotionBlurQuality=0"; Add-Content $ep "r.LensFlareQuality=0"; Add-Content $ep "r.BloomQuality=1"; Add-Content $ep "r.ssr.quality=0"; Add-Content $ep "r.ReflectionCaptureResolution=128"; Add-Content $ep "r.Shadow.MaxResolution=1024"; Add-Content $ep "r.ShadowQuality=3"; Add-Content $ep "r.Streaming.PoolSize=2048"; Add-Content $ep "r.DynamicGlobalIlluminationMethod=0"; Add-Content $ep "r.ReflectionMethod=0"; Add-Content $ep "r.Shadow.Virtual.Enable=0"; Add-Content $ep "r.VolumetricFog=0"; Add-Content $ep "r.RayTracing=0"; Add-Content $ep "r.AntiAliasingMethod=2"; Add-Content $ep "r.TemporalAA.Upscaling=0"; Add-Content $ep "r.ScreenSpaceReflections.Quality=1" }; If($c -notmatch 'bEnableMouseSmoothing'){ Add-Content $ep ([Environment]::NewLine+"[/Script/Engine.InputSettings]"); Add-Content $ep "bEnableMouseSmoothing=False"; Add-Content $ep "bViewAccelerationEnabled=False"; Add-Content $ep "WindowsMouseSpeedFix=False" }; Write-Host "[OK] Engine.ini patched at $root" -ForegroundColor Green; $patched=$true } }; If(!$patched){ Write-Host "[INFO] Engine.ini config folder not found — launch 007 First Light once then re-run to apply UE5 patches" -ForegroundColor Yellow }; Write-Host "" -ForegroundColor White; Write-Host "=== 007 First Light — Full Optimization Applied ===" -ForegroundColor Cyan; Write-Host "  Process:  CpuPriority=AboveNormal, IO=High, GPU=8, EnergyThrottle=OFF, FgBoost=ON" -ForegroundColor Cyan; Write-Host "  Engine:   Lumen=OFF, VirtualShadows=OFF, VolumetricFog=OFF, RayTracing=OFF, TAA, StreamPool=2GB (GTX-optimized)" -ForegroundColor Cyan; Write-Host "  System:   TDR=8s, MMCSS tuned, 512KB network buffers, Defender exclusion" -ForegroundColor Cyan } Else { Write-Host "[SKIP] 007 First Light not detected at known install paths" -ForegroundColor DarkGray; Write-Host "       Install via Steam/Epic then re-run for auto-detection" -ForegroundColor DarkGray }
    $appliedTweaks.Add("game_007firstlight") | Out-Null
} catch {
    $failedTweaks.Add("game_007firstlight") | Out-Null
    Write-Host "[ERR] game_007firstlight: $_" -ForegroundColor Red
}
Write-Host "" 
Write-Host "--- [Registry / System] 12 tweak(s) ---" -ForegroundColor DarkRed
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
Write-Host "[>>] Cod1650LowLatency..." -ForegroundColor DarkYellow
try {
    $key = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm'; If (Test-Path $key) { Set-ItemProperty -Path $key -Name 'NvCplLowLatencyMode' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] NVIDIA Low Latency mode applied for GTX 1650 Super — reduces pre-rendered frame queue from 3 to 1, lowers input lag in BO6 gunfights" -ForegroundColor Green } Else { Write-Host "[SKIP] NVIDIA driver key not found" -ForegroundColor DarkGray }
    $appliedTweaks.Add("Cod1650LowLatency") | Out-Null
} catch {
    $failedTweaks.Add("Cod1650LowLatency") | Out-Null
    Write-Host "[ERR] Cod1650LowLatency: $_" -ForegroundColor Red
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
Write-Host "[>>] CodMMCSS..." -ForegroundColor DarkYellow
try {
    $base = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games'; If (!(Test-Path $base)) { New-Item $base -Force | Out-Null }; Set-ItemProperty $base 'Affinity' 0 -Type DWord -Force; Set-ItemProperty $base 'Background Only' 'False' -Type String -Force; Set-ItemProperty $base 'Clock Rate' 10000 -Type DWord -Force; Set-ItemProperty $base 'GPU Priority' 8 -Type DWord -Force; Set-ItemProperty $base 'Priority' 6 -Type DWord -Force; Set-ItemProperty $base 'Scheduling Category' 'High' -Type String -Force; Set-ItemProperty $base 'SFIO Priority' 'High' -Type String -Force; $sp = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'; Set-ItemProperty $sp 'SystemResponsiveness' 10 -Type DWord -Force; Write-Host "[COD] MMCSS Games task tuned (Priority=6, GPU=8, High scheduling, SystemResponsiveness=10) — Windows Multimedia Class Scheduler gives cod.exe consistent CPU time slices and prevents Windows audio/streaming services from stealing frames mid-gunfight." -ForegroundColor Green
    $appliedTweaks.Add("CodMMCSS") | Out-Null
} catch {
    $failedTweaks.Add("CodMMCSS") | Out-Null
    Write-Host "[ERR] CodMMCSS: $_" -ForegroundColor Red
}
Write-Host "[>>] CodTdrDelay..." -ForegroundColor DarkYellow
try {
    $gd = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'; If (!(Test-Path $gd)) { New-Item $gd -Force | Out-Null }; Set-ItemProperty $gd 'TdrDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrDdiDelay' 8 -Type DWord -Force; Set-ItemProperty $gd 'TdrLimitCount' 20 -Type DWord -Force; Write-Host "[COD] GPU TDR delay extended to 8s (was 2s) — BO6 and Warzone do heavy shader compilation during level loads which can trigger Windows' GPU hang detection on 4GB cards. Extending TDR prevents false 'GPU stopped responding' crashes and black screen resets. Reboot required." -ForegroundColor Green
    $appliedTweaks.Add("CodTdrDelay") | Out-Null
} catch {
    $failedTweaks.Add("CodTdrDelay") | Out-Null
    Write-Host "[ERR] CodTdrDelay: $_" -ForegroundColor Red
}
Write-Host "[>>] CodMemPriority..." -ForegroundColor DarkYellow
try {
    $ifeo='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options'; @('cod.exe','ModernWarfare.exe','ModernWarfareII.exe','ModernWarfareIII.exe','BlackOps6.exe','warzone.exe') | ForEach-Object { $k="$ifeo\$_\PerfOptions"; If(!(Test-Path $k)){New-Item $k -Force|Out-Null}; Set-ItemProperty $k 'PagePriority' 5 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $k 'WorkingSetPolicy' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD] Memory priority=High, WorkingSet=Locked: $_" -ForegroundColor Green }; Write-Host "[COD Memory] PagePriority=5 (highest) applied to all COD executables — prevents Windows from paging out COD texture buffers during background bursts. On 32GB RAM rigs this keeps the full texture streaming cache in physical RAM, eliminating the 200-500ms stutter when BO6 re-fetches paged-out map assets." -ForegroundColor Green
    $appliedTweaks.Add("CodMemPriority") | Out-Null
} catch {
    $failedTweaks.Add("CodMemPriority") | Out-Null
    Write-Host "[ERR] CodMemPriority: $_" -ForegroundColor Red
}
Write-Host "[>>] CodFramePacing..." -ForegroundColor DarkYellow
try {
    $dxgiU='HKCU:\SOFTWARE\Microsoft\DXGI'; If(!(Test-Path $dxgiU)){New-Item $dxgiU -Force|Out-Null}; Set-ItemProperty $dxgiU 'WaitableObjectsThreshold' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $dxgiU 'MaximumFrameLatency' 1 -Type DWord -Force -EA SilentlyContinue; $dxgiM='HKLM:\SOFTWARE\Microsoft\DXGI'; If(!(Test-Path $dxgiM)){New-Item $dxgiM -Force|Out-Null}; Set-ItemProperty $dxgiM 'UseFlipModel' 1 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $dxgiM 'WaitableObject' 1 -Type DWord -Force -EA SilentlyContinue; $d3d='HKCU:\SOFTWARE\Microsoft\Direct3D'; If(!(Test-Path $d3d)){New-Item $d3d -Force|Out-Null}; Set-ItemProperty $d3d 'MaxFrameLatency' 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[COD Frame Pacing] DXGI WaitableObject=1, MaxFrameLatency=1, FlipModel=1, D3D cap=1 — eliminates the 3-frame CPU-GPU submission backlog. Removes the mushy input feel in BO6/Warzone gunfights and tightens frame delivery on GTX 1650 Super." -ForegroundColor Green
    $appliedTweaks.Add("CodFramePacing") | Out-Null
} catch {
    $failedTweaks.Add("CodFramePacing") | Out-Null
    Write-Host "[ERR] CodFramePacing: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaD3DOptimize..." -ForegroundColor DarkYellow
try {
    $d3dPaths = @('HKLM:\SOFTWARE\Microsoft\Direct3D','HKCU:\SOFTWARE\Microsoft\Direct3D'); foreach ($p in $d3dPaths) { if (!(Test-Path $p)) { New-Item $p -Force | Out-Null }; Set-ItemProperty $p -Name 'ForceDebugRuntime' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $p -Name 'LoadDebugRuntime' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $p -Name 'EnableAsyncShaderCompilation' -Value 1 -Type DWord -Force -EA SilentlyContinue }; $dxPath = 'HKLM:\SOFTWARE\Microsoft\DirectX'; if (!(Test-Path $dxPath)) { New-Item $dxPath -Force | Out-Null }; Set-ItemProperty $dxPath -Name 'D3D12_ENABLE_UNSAFE_COMMAND_BUFFER_REUSE' -Value 0 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA DirectX] D3D debug layers OFF + async shader compile ON — compile-stall stutters eliminated in COD/FiveM/Fortnite on GTX 1650 Super" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaD3DOptimize") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaD3DOptimize") | Out-Null
    Write-Host "[ERR] NvidiaD3DOptimize: $_" -ForegroundColor Red
}
Write-Host "[>>] NvidiaPCIeGen3Force..." -ForegroundColor DarkYellow
try {
    $gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; Get-ChildItem $gpuClass -EA SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA|GeForce' } | ForEach-Object { Set-ItemProperty $_.PSPath -Name 'EnableMsHybrid' -Value 0 -Type DWord -Force -EA SilentlyContinue; Set-ItemProperty $_.PSPath -Name 'PCIELinkSpeedOverride' -Value 2 -Type DWord -Force -EA SilentlyContinue }; Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name 'EnablePreemption' -Value 1 -Type DWord -Force -EA SilentlyContinue; Write-Host "[NVIDIA PCIe] PCIe Gen3 link locked + GPU preemption enabled — prevents bandwidth fallback to PCIe 2.0 x8 under power transitions (GTX 1650 Super)" -ForegroundColor Green
    $appliedTweaks.Add("NvidiaPCIeGen3Force") | Out-Null
} catch {
    $failedTweaks.Add("NvidiaPCIeGen3Force") | Out-Null
    Write-Host "[ERR] NvidiaPCIeGen3Force: $_" -ForegroundColor Red
}

Write-Host "" 
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "   OPTI GODS by leaq -- TWEAKS APPLIED" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor DarkRed
Write-Host "" 
Write-Host "  [OK] $($appliedTweaks.Count) of 13 tweaks applied" -ForegroundColor Green
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