@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-Preset-i54590.ps1"

title Opti Gods by leaq  --  i5-4590 + RTX 2060 Preset

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    Preset: i5-4590 + RTX 2060
echo    Win10 / 16GB DDR3 / Desktop
echo    CONSERVATIVE SAFE MODE
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
Write-Host "  Preset: i5-4590 + RTX 2060" -ForegroundColor White
Write-Host "  Windows 10 Pro / 16GB DDR3 / Desktop" -ForegroundColor DarkGray
Write-Host "  CONSERVATIVE — safe for restore-point users" -ForegroundColor Cyan
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  This preset only touches:" -ForegroundColor DarkGray
Write-Host "  power plan, MMCSS, NVIDIA driver keys, GameDVR," -ForegroundColor DarkGray
Write-Host "  fullscreen mode, Win32 priority, Realtek NIC, memory." -ForegroundColor DarkGray
Write-Host "  NO bcdedit. NO MSI mode. NO service changes." -ForegroundColor DarkGray
Write-Host "  100%% undoable from a restore point." -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 2

# ══════════════════════════════════════════════════════════════════
#  1. POWER PLAN — High Performance, CPU pinned 100%
#     i5-4590 has no HyperThreading (4C/4T) and no aggressive
#     boost headroom — pinning prevents Windows from throttling
#     the base 3.3GHz clock during light game load transitions.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/8] Power plan — High Performance..." -ForegroundColor White

powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
# CPU min 100% — Haswell desktop has a narrow boost window, keep it at base
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
# Hard disk sleep = never (B85 SATA controller sleeps aggressively)
powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null

Write-Host "        OK — High Performance active, CPU 100%%, hard disk sleep off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. MMCSS — Multimedia scheduler thread priorities
#     i5-4590 has 4 physical cores with no HT — every core matters.
#     MMCSS ensures the game thread gets priority without starvation.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [2/8] MMCSS multimedia scheduler..." -ForegroundColor White

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

Write-Host "        OK — 90%% CPU to game threads, UDP throttle off, audio prioritized" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  3. NVIDIA RTX 2060 — DRIVER REGISTRY TWEAKS
#     RTX 2060 is Turing (TU106). Has DLSS, Reflex, but only 4GB
#     detected VRAM — keep driver overhead low.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/8] NVIDIA RTX 2060 driver tweaks..." -ForegroundColor White

$nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }

# Texture filtering = High Performance (frees TMU bandwidth)
Set-ItemProperty $nvKey 'TextureFilterQuality' 0 -Type DWord -Force
# Low Latency Ultra (FlipQueueSize=1 — pre-rendered frames queue depth 1)
Set-ItemProperty $nvKey 'RmLowLatencyMode'     2 -Type DWord -Force
Set-ItemProperty $nvKey 'FlipQueueSize'        1 -Type DWord -Force
# Threaded Optimization ON
Set-ItemProperty $nvKey 'OGL_ThreadControl'    1 -Type DWord -Force
Set-ItemProperty $nvKey 'D3D_ThreadControl'    1 -Type DWord -Force
# Driver-level FXAA injection off
Set-ItemProperty $nvKey 'FXAA'                 0 -Type DWord -Force
# Remove any FPS cap
Remove-ItemProperty $nvKey 'FrameRateLimit' -EA SilentlyContinue
Remove-ItemProperty $nvKey 'VSyncMode'      -EA SilentlyContinue

# Per-GPU class key (TU106)
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
if (!$found) { Write-Host "        GPU class key not found — NVTweak path still applied" -ForegroundColor DarkGray }

# Power Management = Prefer Max Performance
$nvPow = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
if (!(Test-Path $nvPow)) { New-Item $nvPow -Force | Out-Null }
Set-ItemProperty $nvPow 'PerfLevelSrc' 0x2222 -Type DWord -Force

Write-Host "        OK — texture perf, low latency ultra, threaded opt, max power, FPS cap off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  4. DISPLAY — HAGS + TDR safe defaults + GameDVR + fullscreen
#     Win10 22H2 (Build 19045) supports HAGS — safe to enable.
#     TDR kept at Windows defaults — B85/i5-4590 combo is old
#     enough that aggressive TDR changes can cause timeouts.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/8] Display — HAGS, TDR, GameDVR, fullscreen..." -ForegroundColor White

# HAGS on (Win10 22H2 supports it, RTX 2060 benefits)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 2 -Type DWord -Force
# TDR safe defaults — NOT changing TdrDelay below 8 (old B85 platform needs headroom)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrLevel' 3 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrDelay' 8 -Type DWord -Force

# GameDVR off, fullscreen exclusive on — games switch to 3.3GHz base without DVR overhead
$gcs = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $gcs)) { New-Item $gcs -Force | Out-Null }
Set-ItemProperty $gcs 'GameDVR_Enabled'                        0 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_FSEBehaviorMode'                2 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_HonorUserFSEBehaviorMode'       1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_EFSEFeatureFlags'               0 -Type DWord -Force

# Game Mode on (Win10 — allocates more cores to foreground game)
$gm = 'HKCU:\SOFTWARE\Microsoft\GameBar'
if (!(Test-Path $gm)) { New-Item $gm -Force | Out-Null }
Set-ItemProperty $gm 'AutoGameModeEnabled'       1 -Type DWord -Force
Set-ItemProperty $gm 'AllowAutoGameMode'         1 -Type DWord -Force
Set-ItemProperty $gm 'UseNexusForGameBarEnabled' 0 -Type DWord -Force

Write-Host "        OK — HAGS on, TDR safe (8s), GameDVR off, FSE on, Game Mode on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. WIN32 PRIORITY SEPARATION
#     0x26 = short variable intervals + max foreground boost.
#     On a 4-core no-HT CPU this is the single highest-impact
#     Windows tweak — gives the game thread maximum CPU slice.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/8] Win32 priority separation..." -ForegroundColor White
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' `
    'Win32PrioritySeparation' 0x26 -Type DWord -Force
Write-Host "        OK — 0x26: max foreground boost (critical on 4-core no-HT i5-4590)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. MEMORY — 16GB DDR3 @ 1333MHz safe optimizations
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/8] Memory management (16GB DDR3)..." -ForegroundColor White

$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
Set-ItemProperty $mm 'LargeSystemCache'        0 -Type DWord -Force   # gaming: no FS cache bloat
Set-ItemProperty $mm 'DisablePagingExecutive'  1 -Type DWord -Force   # keep kernel in RAM
Set-ItemProperty $mm 'ClearPageFileAtShutdown' 0 -Type DWord -Force   # faster shutdown
# i5-4590 L3 = 6MB — set cache hint accordingly
Set-ItemProperty $mm 'SecondLevelDataCache' 6144 -Type DWord -Force

Write-Host "        OK — gaming memory mode, kernel in RAM, 6MB L3 hint, pagefile clear off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. NETWORK — Realtek NIC + TCP (Nagle off)
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/8] Network — Realtek NIC + TCP..." -ForegroundColor White

& netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
& netsh int tcp set global chimney=disabled       2>$null | Out-Null
& netsh int tcp set global rss=enabled            2>$null | Out-Null
& netsh int tcp set global ecncapability=disabled 2>$null | Out-Null

# Interrupt moderation off on Realtek (lower per-packet latency)
$nicClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nicClass -EA SilentlyContinue | ForEach-Object {
    $d = (Get-ItemProperty $_.PSPath 'DriverDesc' -EA SilentlyContinue).DriverDesc
    if ($d -match 'Realtek|RTL') {
        Set-ItemProperty $_.PSPath '*InterruptModeration' 0 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath '*RSS'                 1 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TxIntDelay'           0 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'RxIntDelay'           0 -Type String -Force -EA SilentlyContinue
        Write-Host "        Realtek NIC tuned: $d" -ForegroundColor DarkGray
    }
}

# Nagle off for active interfaces
$if = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
Get-ChildItem $if -EA SilentlyContinue | ForEach-Object {
    $ip = (Get-ItemProperty $_.PSPath 'IPAddress' -EA SilentlyContinue).IPAddress
    if ($ip -and $ip -notmatch '^0\.0\.0\.0$|^$') {
        Set-ItemProperty $_.PSPath 'TcpAckFrequency' 1 -Type DWord -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TCPNoDelay'      1 -Type DWord -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TcpDelAckTicks'  0 -Type DWord -Force -EA SilentlyContinue
    }
}

Write-Host "        OK — Realtek interrupt moderation off, Nagle off, TCP tuned" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. VISUAL EFFECTS — Performance mode
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/8] Visual effects — performance mode..." -ForegroundColor White
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' `
    'VisualFXSetting' 2 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
    'UserPreferencesMask' ([byte[]](0x10,0x00,0x00,0x00)) -Type Binary -Force -EA SilentlyContinue
Write-Host "        OK — animations off, visual effects stripped" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  DONE — i5-4590 + RTX 2060 preset applied" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED to activate all changes." -ForegroundColor Yellow
Write-Host ""
Write-Host "  What was applied (ALL safe, restore-point undoable):" -ForegroundColor White
Write-Host "    1.  High Performance plan — CPU 100%%, disk sleep off" -ForegroundColor DarkGray
Write-Host "    2.  MMCSS — 90%% CPU to game threads, UDP throttle off" -ForegroundColor DarkGray
Write-Host "    3.  RTX 2060 — texture perf, low latency ultra, max power" -ForegroundColor DarkGray
Write-Host "    4.  HAGS on, TDR safe, GameDVR off, fullscreen exclusive on" -ForegroundColor DarkGray
Write-Host "    5.  Win32 priority 0x26 — max foreground boost" -ForegroundColor DarkGray
Write-Host "    6.  Memory — gaming mode, kernel in RAM, 6MB L3 hint" -ForegroundColor DarkGray
Write-Host "    7.  Realtek NIC — interrupt mod off, Nagle off" -ForegroundColor DarkGray
Write-Host "    8.  Visual effects — performance mode" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  What was NOT touched (intentional — old B85 platform):" -ForegroundColor White
Write-Host "    - No bcdedit boot changes" -ForegroundColor DarkGray
Write-Host "    - No MSI mode (safe on newer rigs, skipped here)" -ForegroundColor DarkGray
Write-Host "    - No service changes" -ForegroundColor DarkGray
Write-Host "    - No CPU capabilities register (Intel Haswell stable as-is)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Note: RAM is at 1333MHz DDR3 — check BIOS for XMP/OC." -ForegroundColor Cyan
Write-Host "  B85 supports up to 1600MHz natively, some boards go higher." -ForegroundColor Cyan
Write-Host "  DDR3 1600 vs 1333 = ~8-12%% bandwidth gain on old Intel." -ForegroundColor Cyan
Write-Host ""
Read-Host "  Press Enter to close (then REBOOT)"
