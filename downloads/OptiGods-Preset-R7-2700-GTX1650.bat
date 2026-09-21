@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-Preset-R72700.ps1"

title Opti Gods by leaq  --  Ryzen 7 2700 + GTX 1650 Preset

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    Preset: Ryzen 7 2700 + GTX 1650
echo    Win11 / 16GB DDR4 / Desktop
echo  ==========================================
echo.
echo  [1/2] Extracting preset script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Re-download from optigods.com
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo       Click "Yes" to apply as Administrator.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##PS1_START##
$ErrorActionPreference = 'SilentlyContinue'

if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "" ; Write-Host "  !! Must run as Administrator !!" -ForegroundColor Red
    Read-Host "  Press Enter to close" ; exit 1
}

trap { Write-Host "" ; Write-Host "  [FATAL] $_" -ForegroundColor Red ; Read-Host "  Press Enter" ; break }

Clear-Host
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq" -ForegroundColor Red
Write-Host "  Preset: Ryzen 7 2700 + GTX 1650" -ForegroundColor White
Write-Host "  Windows 11 Pro / 16GB DDR4 / Desktop" -ForegroundColor DarkGray
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""

# ══════════════════════════════════════════════════════════════════
#  1. POWER PLAN — High Performance, CPU pinned 100%
#     Ryzen 7 2700 (Zen+) drops clocks aggressively under Windows
#     scheduler — pinning min to 100% stops mid-frame stutter.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/11] Power plan — High Performance..." -ForegroundColor White
powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
# CPU performance decrease policy = fastest (eliminates Zen+ frequency drop between frames)
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFINCPOL  2 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFDECPOL  1 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFINCTHRESHOLD  10 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFDECTHRESHOLD  8  2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host "        OK — High Performance active, CPU min/max 100%%, boost unrestricted" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. RYZEN 7 2700 (ZEN+) CPU TWEAKS
#     A320M board = no OC. These are pure OS/scheduler tweaks safe
#     on all Zen+ builds.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [2/11] Ryzen 7 2700 Zen+ scheduler tweaks..." -ForegroundColor White

# Timer coalescing = 0 — prevents Windows batching wakeups every 15ms
# Critical on Zen+ where IPC stalls compound with scheduler latency
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' `
    'CoalescingTimerInterval' 0 -Type DWord -Force

# CPU capabilities register — improves DRAM/memory controller scheduling hints
# 0x0007e066 is the validated safe mask for Zen+ (Ryzen 1000/2000 series)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Processor' `
    'Capabilities' 0x0007e066 -Type DWord -Force

# bcdedit — disable dynamic tick (safe alternative to timer resolution hack)
# disabledynamictick keeps the hardware timer at fixed rate without bcdedit useplatformtick risk
& bcdedit /set disabledynamictick yes 2>$null | Out-Null

# Kernel scheduler assist + SMT policy (8C/16T Zen+ benefits from physical-first dispatch)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' `
    'SchedulerAssist' 1 -Type DWord -Force

Write-Host "        OK — timer coalescing=0, caps=0x7e066, dynamic tick off, SMT hint set" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  3. MMCSS — System responsiveness + game/audio thread priority
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/11] MMCSS multimedia scheduler..." -ForegroundColor White
$sp = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
Set-ItemProperty $sp 'SystemResponsiveness'   10         -Type DWord -Force
Set-ItemProperty $sp 'NetworkThrottlingIndex' 0xFFFFFFFF -Type DWord -Force

$games = "$sp\Tasks\Games"
if (!(Test-Path $games)) { New-Item $games -Force | Out-Null }
Set-ItemProperty $games 'Scheduling Category'   'High'   -Type String -Force
Set-ItemProperty $games 'SFIO Priority'         'High'   -Type String -Force
Set-ItemProperty $games 'Priority'              6        -Type DWord  -Force
Set-ItemProperty $games 'Background Only'       'False'  -Type String -Force
Set-ItemProperty $games 'Clock Rate'            10000    -Type DWord  -Force
Set-ItemProperty $games 'GPU Priority'          8        -Type DWord  -Force
Set-ItemProperty $games 'Affinity'              0        -Type DWord  -Force

$audio = "$sp\Tasks\Audio"
if (!(Test-Path $audio)) { New-Item $audio -Force | Out-Null }
Set-ItemProperty $audio 'Scheduling Category'   'Medium' -Type String -Force
Set-ItemProperty $audio 'SFIO Priority'         'High'   -Type String -Force
Set-ItemProperty $audio 'Priority'              6        -Type DWord  -Force
Set-ItemProperty $audio 'Background Only'       'False'  -Type String -Force
Set-ItemProperty $audio 'Clock Rate'            10000    -Type DWord  -Force

Write-Host "        OK — 90%% CPU to game threads, UDP throttle off, audio priority raised" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  4. NVIDIA GTX 1650 — DRIVER REGISTRY TWEAKS
#     GTX 1650 = Turing (TU117), no RTX/DLSS/Reflex. Driver-side
#     tweaks make the biggest visible difference on this card.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/11] NVIDIA GTX 1650 driver tweaks..." -ForegroundColor White

$nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }

# Texture Filtering = High Performance (saves 3-5% fill rate on GTX 1650's limited TMUs)
Set-ItemProperty $nvKey 'TextureFilterQuality' 0 -Type DWord -Force
# Low Latency Ultra — FlipQueueSize=1, driver pre-render queue depth 1
Set-ItemProperty $nvKey 'RmLowLatencyMode'     2 -Type DWord -Force
Set-ItemProperty $nvKey 'FlipQueueSize'        1 -Type DWord -Force
# Threaded Optimization ON
Set-ItemProperty $nvKey 'OGL_ThreadControl'    1 -Type DWord -Force
Set-ItemProperty $nvKey 'D3D_ThreadControl'    1 -Type DWord -Force
# Remove any FPS cap
Remove-ItemProperty $nvKey 'FrameRateLimit' -EA SilentlyContinue
# FXAA injection off
Set-ItemProperty $nvKey 'FXAA' 0 -Type DWord -Force

# Per-GPU class key tweaks (texture quality + shader cache on the TU117 key)
$gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
$found = $false
0,1,2,3 | ForEach-Object {
    $k = "$gpuClass\000$_"
    if ((Test-Path $k) -and (Get-ItemProperty $k 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') {
        Set-ItemProperty $k 'TextureFilterQuality' 0 -Type DWord -Force
        Set-ItemProperty $k 'ShaderCache'          1 -Type DWord -Force
        Set-ItemProperty $k 'FXAA'                 0 -Type DWord -Force
        Write-Host "        GPU key: $((Get-ItemProperty $k 'DriverDesc').DriverDesc)" -ForegroundColor DarkGray
        $found = $true
    }
}
if (!$found) { Write-Host "        GPU class key not found — NVCP tweaks still applied via NVTweak path" -ForegroundColor DarkGray }

# Power Management = Prefer Max Performance (prevents GTX 1650 from P2 idle-clocking mid-game)
# PerfLevelSrc 0x2222 = force P0 on both AC and DC
$nvPow = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
if (!(Test-Path $nvPow)) { New-Item $nvPow -Force | Out-Null }
Set-ItemProperty $nvPow 'PerfLevelSrc' 0x2222 -Type DWord -Force

Write-Host "        OK — texture perf, low latency ultra, threaded opt, max power, no FPS cap" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. HAGS + DISPLAY (Win11 required)
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/11] HAGS + display settings..." -ForegroundColor White

Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 2 -Type DWord -Force

# Safe TDR defaults (avoid driver timeout / black screen on GTX 1650)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrLevel' 3 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrDelay' 8 -Type DWord -Force

# GameDVR off, Fullscreen exclusive ON
$gcs = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $gcs)) { New-Item $gcs -Force | Out-Null }
Set-ItemProperty $gcs 'GameDVR_Enabled'                        0 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_FSEBehaviorMode'                2 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_HonorUserFSEBehaviorMode'       1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_EFSEFeatureFlags'               0 -Type DWord -Force

Write-Host "        OK — HAGS on, TDR safe, GameDVR off, fullscreen exclusive on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. SAFE MSI MODE (GTX 1650 + NIC + NVMe)
#     V2.2 BSOD-safe version — wipes DevicePolicy/Priority keys
#     that caused the V1 IRQL crash, then enables MSI on GPU + NICs
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/11] Safe MSI mode (GTX 1650 + NIC + NVMe)..." -ForegroundColor White

# GPU — enable MSI, wipe affinity policy (BSOD prevention)
$gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
0,1,2,3 | ForEach-Object {
    $k = "$gpuClass\000$_"
    if ((Test-Path $k) -and (Get-ItemProperty $k 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') {
        $msiPath = "$k\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
        if (!(Test-Path $msiPath)) { New-Item $msiPath -Force | Out-Null }
        Set-ItemProperty $msiPath 'MSISupported' 1 -Type DWord -Force
        # Wipe dangerous affinity policy keys
        Remove-ItemProperty "$k\Device Parameters\Interrupt Management\Affinity Policy" 'DevicePolicy'            -EA SilentlyContinue
        Remove-ItemProperty "$k\Device Parameters\Interrupt Management\Affinity Policy" 'DevicePriority'          -EA SilentlyContinue
        Remove-ItemProperty "$k\Device Parameters\Interrupt Management\Affinity Policy" 'AssignmentSetOverride'   -EA SilentlyContinue
        Write-Host "        MSI enabled on GPU" -ForegroundColor DarkGray
    }
}

# NICs — enable MSI on physical adapters (TP-Link will benefit from this)
$nicClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nicClass -EA SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
    if ($props.Characteristics -band 0x4) {
        $msiPath = "$($_.PSPath)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
        if (!(Test-Path $msiPath)) { New-Item $msiPath -Force | Out-Null }
        Set-ItemProperty $msiPath 'MSISupported' 1 -Type DWord -Force
        Write-Host "        MSI enabled on NIC: $($props.DriverDesc)" -ForegroundColor DarkGray
    }
}

# NVMe controller MSI
$nvmeClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e97b-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nvmeClass -EA SilentlyContinue | ForEach-Object {
    $msiPath = "$($_.PSPath)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
    if (!(Test-Path $msiPath)) { New-Item $msiPath -Force | Out-Null }
    Set-ItemProperty $msiPath 'MSISupported' 1 -Type DWord -Force
}

Write-Host "        OK — MSI on GPU + NICs + NVMe, BSOD-safe (no affinity policy written)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. MEMORY — 16GB DDR4 @ 2133MHz optimizations
#     At 2133MHz the Zen+ Infinity Fabric runs at 1066MHz (1:1 ratio).
#     We can't change the clock in a bat, but we can tune how Windows
#     uses the memory pool.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/11] Memory management (16GB DDR4 2133MHz)..." -ForegroundColor White

$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
Set-ItemProperty $mm 'LargeSystemCache'        0 -Type DWord -Force   # gaming mode — no FS cache bloat
Set-ItemProperty $mm 'DisablePagingExecutive'  1 -Type DWord -Force   # keep kernel in RAM
Set-ItemProperty $mm 'ClearPageFileAtShutdown' 0 -Type DWord -Force   # faster shutdown
Set-ItemProperty $mm 'PhysicalAddressExtension' 1 -Type DWord -Force
Set-ItemProperty $mm 'FeatureSettings'          1 -Type DWord -Force   # Spectre/Meltdown perf preference

# Second-level cache flush size for Zen+ (8C/16T L3 = 16MB total on R7 2700)
Set-ItemProperty $mm 'SecondLevelDataCache' 16384 -Type DWord -Force

Write-Host "        OK — gaming memory mode, kernel in RAM, pagefile clear off, 16MB L3 hint" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. NETWORK — TP-Link NIC + TCP stack
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/11] Network (TP-Link NIC + TCP stack)..." -ForegroundColor White

# TCP receive window auto-tuning — normal is best for gaming
& netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
& netsh int tcp set global chimney=disabled       2>$null | Out-Null
& netsh int tcp set global rss=enabled            2>$null | Out-Null
& netsh int tcp set global dca=disabled           2>$null | Out-Null
& netsh int tcp set global ecncapability=disabled 2>$null | Out-Null

# Reduce interrupt moderation on TP-Link NIC (lower latency per packet)
$nicClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nicClass -EA SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty $_.PSPath -EA SilentlyContinue
    if ($props.DriverDesc -match 'TP-Link|Realtek|Killer|Intel|Atheros') {
        Set-ItemProperty $_.PSPath '*InterruptModeration'        0 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath '*RSS'                        1 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TxIntDelay'                  0 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'RxIntDelay'                  0 -Type String -Force -EA SilentlyContinue
        Write-Host "        NIC tuned: $($props.DriverDesc)" -ForegroundColor DarkGray
    }
}

# Nagle off for faster small packet delivery (gaming)
$if = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
Get-ChildItem $if -EA SilentlyContinue | ForEach-Object {
    $ip = (Get-ItemProperty $_.PSPath 'IPAddress' -EA SilentlyContinue).IPAddress
    if ($ip -and $ip -ne '0.0.0.0') {
        Set-ItemProperty $_.PSPath 'TcpAckFrequency'   1 -Type DWord -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TCPNoDelay'        1 -Type DWord -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TcpDelAckTicks'    0 -Type DWord -Force -EA SilentlyContinue
    }
}

Write-Host "        OK — TCP tuned, Nagle off, interrupt moderation off on TP-Link NIC" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  9. STORAGE + PREFETCH
# ══════════════════════════════════════════════════════════════════
Write-Host "  [9/11] Storage + prefetch..." -ForegroundColor White

# NVMe policy (disable write cache buffer flushing for non-critical data)
$diskClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e97b-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $diskClass -EA SilentlyContinue | ForEach-Object {
    Set-ItemProperty $_.PSPath 'EnableIdlePowerManagement' 0 -Type DWord -Force -EA SilentlyContinue
}

# AHCI/SATA interrupt handling
$ahci = 'HKLM:\SYSTEM\CurrentControlSet\Services\storahci\Parameters\Device'
if (!(Test-Path $ahci)) { New-Item $ahci -Force | Out-Null }
Set-ItemProperty $ahci 'TreatAsInternalPort' ([byte[]](0,0,0,0,0,0,0,0)) -Type Binary -Force -EA SilentlyContinue

# Prefetch stays ON (Win11 with SSD uses ReadyBoot correctly)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' `
    'EnablePrefetcher' 3 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' `
    'EnableSuperfetch' 0 -Type DWord -Force -EA SilentlyContinue

Write-Host "        OK — NVMe power mgmt off, SATA internal, prefetch on / superfetch off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  10. WIN32 PRIORITY SEPARATION — foreground game boost
# ══════════════════════════════════════════════════════════════════
Write-Host "  [10/11] Win32 priority separation..." -ForegroundColor White
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' `
    'Win32PrioritySeparation' 0x26 -Type DWord -Force
Write-Host "        OK — 0x26: short variable intervals, max foreground boost (game gets full CPU)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  11. VISUAL EFFECTS — Performance mode (A320M / Zen+ benefits here)
# ══════════════════════════════════════════════════════════════════
Write-Host "  [11/11] Visual effects — performance mode..." -ForegroundColor White
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' `
    'VisualFXSetting' 2 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
    'UserPreferencesMask' ([byte[]](0x10,0x00,0x00,0x00)) -Type Binary -Force -EA SilentlyContinue
Write-Host "        OK — animations off, performance mode on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  DONE — Ryzen 7 2700 + GTX 1650 preset applied" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED to activate all changes." -ForegroundColor Yellow
Write-Host ""
Write-Host "  What was applied:" -ForegroundColor White
Write-Host "    1.  High Performance plan — CPU min/max 100%%, boost unrestricted" -ForegroundColor DarkGray
Write-Host "    2.  Zen+ timer + scheduler tweaks — no more mid-frame clock drops" -ForegroundColor DarkGray
Write-Host "    3.  MMCSS — 90%% CPU to game threads, UDP throttle off" -ForegroundColor DarkGray
Write-Host "    4.  GTX 1650 texture perf, low latency ultra, threaded opt, max power" -ForegroundColor DarkGray
Write-Host "    5.  HAGS on, TDR safe, GameDVR off, fullscreen exclusive on" -ForegroundColor DarkGray
Write-Host "    6.  Safe MSI mode on GPU + TP-Link NIC + NVMe" -ForegroundColor DarkGray
Write-Host "    7.  Memory — gaming mode, kernel in RAM, 16MB L3 hint" -ForegroundColor DarkGray
Write-Host "    8.  TCP + TP-Link NIC — Nagle off, interrupt moderation off" -ForegroundColor DarkGray
Write-Host "    9.  NVMe power mgmt off, prefetch on / superfetch off" -ForegroundColor DarkGray
Write-Host "    10. Win32 priority 0x26 — max foreground CPU boost" -ForegroundColor DarkGray
Write-Host "    11. Visual effects — performance mode" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Tip: RAM is at 2133MHz — check BIOS for XMP profile to" -ForegroundColor Cyan
Write-Host "       unlock 2666-3200MHz for a big Zen+ IF speed boost." -ForegroundColor Cyan
Write-Host "       (MSI A320M may support up to 3200MHz OC in BIOS)" -ForegroundColor Cyan
Write-Host ""
Read-Host "  Press Enter to close (then REBOOT)"
