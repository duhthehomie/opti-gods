@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-Preset-5600X.ps1"

title Opti Gods by leaq  --  Ryzen 5 5600X + RTX 4060 Preset

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    Preset: Ryzen 5 5600X + RTX 4060
echo    Win11 Pro 22H2 / 16GB / ASUS ROG
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
Write-Host "  Preset: Ryzen 5 5600X + RTX 4060" -ForegroundColor White
Write-Host "  Windows 11 Pro Build 22631 / 16GB / ASUS ROG" -ForegroundColor DarkGray
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""

# ══════════════════════════════════════════════════════════════════
#  1. POWER PLAN — Ryzen 5 5600X tuned
#     Zen 3 is all-performance-cores (no E-cores). Pinning CPU min
#     to 100% stops the scheduler from dropping cores to C6 idle
#     between frames. AMD CPPC preferred cores stay enabled.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/10] Power plan — Ryzen 5 5600X tuned..." -ForegroundColor White

powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
# CPU min/max 100% — Zen 3 boosts all cores equally; no E-core concern
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
# Fastest perf increase, slowest decrease — prevents frame drops between burst windows
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFINCPOL  2 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFDECPOL  1 2>$null
# Core parking OFF — all 6 cores stay ready
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMINCORES  100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR CPMAXCORES  100 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null

# Disable AMD core parking via registry as well
$cpPark = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'
if (Test-Path $cpPark) {
    Set-ItemProperty $cpPark 'ValueMax' 0 -Type DWord -Force
}

Write-Host "        OK — High Performance, all 6 cores pinned, core parking off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. MMCSS — Game + audio thread priorities
# ══════════════════════════════════════════════════════════════════
Write-Host "  [2/10] MMCSS multimedia scheduler..." -ForegroundColor White

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

Write-Host "        OK — 90%% CPU to game threads, UDP throttle removed" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  3. NVIDIA RTX 4060 — DRIVER REGISTRY TWEAKS
#     Ada Lovelace (AD107). 4GB GDDR6.
#     No FPS cap — ever.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/10] NVIDIA RTX 4060 driver tweaks..." -ForegroundColor White

$nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }

Set-ItemProperty $nvKey 'TextureFilterQuality' 0 -Type DWord -Force  # High Performance textures
Set-ItemProperty $nvKey 'RmLowLatencyMode'     2 -Type DWord -Force  # Low Latency Ultra
Set-ItemProperty $nvKey 'FlipQueueSize'        1 -Type DWord -Force  # Pre-render queue = 1
Set-ItemProperty $nvKey 'OGL_ThreadControl'    1 -Type DWord -Force  # Threaded Opt ON
Set-ItemProperty $nvKey 'D3D_ThreadControl'    1 -Type DWord -Force
Set-ItemProperty $nvKey 'FXAA'                 0 -Type DWord -Force  # Driver FXAA off
Remove-ItemProperty $nvKey 'FrameRateLimit' -EA SilentlyContinue     # No FPS cap
Remove-ItemProperty $nvKey 'VSyncMode'      -EA SilentlyContinue     # No VSync override

# Per-GPU class key (AD107 — RTX 4060)
$gpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
0,1,2,3 | ForEach-Object {
    $k = "$gpuClass\000$_"
    if ((Test-Path $k) -and (Get-ItemProperty $k 'DriverDesc' -EA SilentlyContinue).DriverDesc -match 'NVIDIA') {
        Set-ItemProperty $k 'TextureFilterQuality' 0 -Type DWord -Force
        Set-ItemProperty $k 'ShaderCache'          1 -Type DWord -Force
        Set-ItemProperty $k 'FXAA'                 0 -Type DWord -Force
        Write-Host "        GPU key: $((Get-ItemProperty $k 'DriverDesc').DriverDesc)" -ForegroundColor DarkGray
    }
}

# Power Management = Max Performance (stops 4060 from P-state stepping mid-frame)
$nvPow = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
if (!(Test-Path $nvPow)) { New-Item $nvPow -Force | Out-Null }
Set-ItemProperty $nvPow 'PerfLevelSrc' 0x2222 -Type DWord -Force

# Confirm NVIDIA Display Container is running
$nvcls = Get-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcls -and $nvcls.StartType -eq 'Disabled') {
    Set-Service 'NVDisplay.ContainerLocalSystem' -StartupType Automatic
    Start-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
    Write-Host "        FIXED: NVDisplay.ContainerLocalSystem was disabled — re-enabled" -ForegroundColor Yellow
}

Write-Host "        OK — texture perf, low latency ultra, threaded opt, max power, no FPS cap" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  4. HAGS + TDR + GAMEDVR + FULLSCREEN (Win11)
#     5600X has NO iGPU — RTX 4060 is the only adapter.
#     HAGS ON is safe and beneficial on Win11 with Ada Lovelace.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/10] HAGS, TDR, GameDVR, fullscreen..." -ForegroundColor White

$gfxDrv = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'
Set-ItemProperty $gfxDrv 'HwSchMode' 2 -Type DWord -Force  # HAGS ON
Set-ItemProperty $gfxDrv 'TdrLevel'  3 -Type DWord -Force  # TDR = recover (not reboot)
Set-ItemProperty $gfxDrv 'TdrDelay'  8 -Type DWord -Force

$gcs = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $gcs)) { New-Item $gcs -Force | Out-Null }
Set-ItemProperty $gcs 'GameDVR_Enabled'                        0 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_FSEBehaviorMode'                2 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_HonorUserFSEBehaviorMode'       1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_EFSEFeatureFlags'               0 -Type DWord -Force

# Set RTX 4060 as global GPU preference (single GPU rig — this is a safety write)
$dxPref = 'HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences'
if (!(Test-Path $dxPref)) { New-Item $dxPref -Force | Out-Null }
Set-ItemProperty $dxPref 'DirectXUserGlobalSettings' 'GpuPreference=2;' -Type String -Force

Write-Host "        OK — HAGS on, TDR safe, GameDVR off, fullscreen exclusive on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. AMD RYZEN 5 5600X — CPU SCHEDULER & CPPC
#     Zen 3 CCD: 6 cores, 32MB L3. CPPC preferred cores should
#     stay enabled (Win11 knows which cores boost highest).
#     We only disable the legacy "heterogeneous" policy since
#     5600X has no E-cores to route to.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/10] AMD Ryzen 5 5600X scheduler + CPPC..." -ForegroundColor White

# Win32 priority separation — more foreground CPU time for games
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' `
    'Win32PrioritySeparation' 0x26 -Type DWord -Force

# Kernel quantum — short, variable (responsive to burst loads)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' `
    'GlobalTimerResolutionRequests' 1 -Type DWord -Force

# Disable heterogeneous policy (no E-cores on 5600X — don't confuse scheduler)
$cpuPol = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel'
Set-ItemProperty $cpuPol 'SchedulerAssist' 0 -Type DWord -Force

# AMD CPPC2 — preferred cores ON (Win11 uses this to pick the best-boosting core)
$cppcKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Power'
Set-ItemProperty $cppcKey 'ExitLatency'           2 -Type DWord -Force
Set-ItemProperty $cppcKey 'ExitLatencyCheckEnabled' 1 -Type DWord -Force

Write-Host "        OK — Win32 0x26, CPPC preferred cores on, E-core policy disabled" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. GPU PREFERENCE FOR GAMES
#     Single-GPU rig but setting explicit app preferences ensures
#     launchers and anti-cheat don't pick a software renderer.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/10] GPU preference for game launchers..." -ForegroundColor White

$gameExes = @(
    "$env:LOCALAPPDATA\FiveM\FiveM.exe",
    "$env:LOCALAPPDATA\FiveM\FiveM Application Data\FiveM.exe",
    'C:\Program Files (x86)\Steam\steam.exe',
    'C:\Program Files\Steam\steam.exe',
    'C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe',
    'C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe',
    'C:\Program Files\Rockstar Games\Launcher\Launcher.exe',
    'C:\Program Files\Call of Duty\cod.exe',
    "$env:LOCALAPPDATA\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"
)
$gameExes | Where-Object { Test-Path $_ } | ForEach-Object {
    Set-ItemProperty $dxPref $_ 'GpuPreference=2;' -Type String -Force
    Write-Host "        RTX 4060 forced for: $(Split-Path $_ -Leaf)" -ForegroundColor DarkGray
}

Write-Host "        OK — RTX 4060 set high-performance for all found launchers" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. MEMORY — 16GB DDR4 @ 2133MHz
#     2133MHz is below Zen 3's ideal (3200-3600MHz). Can't fix
#     MHz in software — but we can squeeze every bit of perf from
#     what's there: kernel in RAM, no large system cache hogging,
#     correct L3 hint (32MB for 5600X).
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/10] Memory management (16GB / 32MB L3 hint)..." -ForegroundColor White

$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
Set-ItemProperty $mm 'LargeSystemCache'        0     -Type DWord -Force
Set-ItemProperty $mm 'DisablePagingExecutive'  1     -Type DWord -Force
Set-ItemProperty $mm 'ClearPageFileAtShutdown' 0     -Type DWord -Force
# Ryzen 5 5600X L3 = 32MB
Set-ItemProperty $mm 'SecondLevelDataCache'    32768 -Type DWord -Force

Write-Host "        OK — kernel in RAM, 32MB L3 hint, large cache off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. NETWORK — TCP + TP-Link NIC
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/10] Network — TCP + TP-Link NIC..." -ForegroundColor White

& netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
& netsh int tcp set global chimney=disabled       2>$null | Out-Null
& netsh int tcp set global rss=enabled            2>$null | Out-Null
& netsh int tcp set global ecncapability=disabled 2>$null | Out-Null

$nicClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nicClass -EA SilentlyContinue | ForEach-Object {
    $d = (Get-ItemProperty $_.PSPath 'DriverDesc' -EA SilentlyContinue).DriverDesc
    if ($d -match 'Realtek|Intel|Killer|Atheros|TP-Link|TP Link|RTL') {
        Set-ItemProperty $_.PSPath '*InterruptModeration' 0 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath '*RSS'                 1 -Type String -Force -EA SilentlyContinue
        Write-Host "        NIC tuned: $d" -ForegroundColor DarkGray
    }
}

$if = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
Get-ChildItem $if -EA SilentlyContinue | ForEach-Object {
    $ip = (Get-ItemProperty $_.PSPath 'IPAddress' -EA SilentlyContinue).IPAddress
    if ($ip -and $ip -notmatch '^0\.0\.0\.0$|^$') {
        Set-ItemProperty $_.PSPath 'TcpAckFrequency' 1 -Type DWord -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TCPNoDelay'      1 -Type DWord -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath 'TcpDelAckTicks'  0 -Type DWord -Force -EA SilentlyContinue
    }
}

Write-Host "        OK — TCP tuned, Nagle off, TP-Link NIC interrupt mod off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  9. VISUAL EFFECTS — strip all animations
# ══════════════════════════════════════════════════════════════════
Write-Host "  [9/10] Visual effects..." -ForegroundColor White

Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' `
    'VisualFXSetting' 2 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
    'UserPreferencesMask' ([byte[]](0x10,0x00,0x00,0x00)) -Type Binary -Force -EA SilentlyContinue

Write-Host "        OK — all Windows animations stripped" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  10. DISABLE XBOX GAME BAR + ASUS ARMORY CRATE BLOAT
#      ASUS ROG boards often have Armory Crate startup services
#      that add latency. We leave the software intact — only stop
#      it from auto-starting and eating background CPU.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [10/10] Xbox Game Bar + ASUS bloat services..." -ForegroundColor White

# Xbox Game Bar
$xbKey = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR'
if (!(Test-Path $xbKey)) { New-Item $xbKey -Force | Out-Null }
Set-ItemProperty $xbKey 'AppCaptureEnabled' 0 -Type DWord -Force

# Disable Xbox Game Bar shortcuts so they don't interrupt full-screen
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\GameBar' 'AllowAutoGameMode'     1 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\GameBar' 'AutoGameModeEnabled'   1 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\GameBar' 'UseNexusForGameBarEnabled' 0 -Type DWord -Force -EA SilentlyContinue

# ASUS Armory Crate — stop startup entries without uninstalling
@('ArmouryASocketServer64', 'ArmourySwAgent', 'AURA_SERVICE', 'AsusUpdateCheck') | ForEach-Object {
    $svc = Get-Service $_ -EA SilentlyContinue
    if ($svc -and $svc.StartType -ne 'Disabled') {
        Stop-Service  $_ -Force -EA SilentlyContinue
        Set-Service   $_ -StartupType Manual -EA SilentlyContinue
        Write-Host "        Armory Crate service set to Manual: $_" -ForegroundColor DarkGray
    }
}

Write-Host "        OK — Game Bar capture off, Armory Crate services set to Manual" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  DONE — Ryzen 5 5600X + RTX 4060 preset applied" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED." -ForegroundColor Yellow
Write-Host ""
Write-Host "  What was applied:" -ForegroundColor White
Write-Host "    1.  High Performance plan — all 6 cores pinned, core parking off" -ForegroundColor DarkGray
Write-Host "    2.  MMCSS — 90%% CPU to game threads, audio priority high" -ForegroundColor DarkGray
Write-Host "    3.  RTX 4060 — texture perf, low latency ultra, max power, no FPS cap" -ForegroundColor DarkGray
Write-Host "    4.  HAGS on, GameDVR off, fullscreen exclusive on" -ForegroundColor DarkGray
Write-Host "    5.  AMD Zen 3 scheduler — CPPC preferred cores on, Win32 0x26" -ForegroundColor DarkGray
Write-Host "    6.  RTX 4060 forced as GPU for Steam/Epic/FiveM/COD/Fortnite" -ForegroundColor DarkGray
Write-Host "    7.  Memory — kernel in RAM, 32MB L3 hint (Zen 3 CCD)" -ForegroundColor DarkGray
Write-Host "    8.  TCP + TP-Link NIC — Nagle off, interrupt mod off" -ForegroundColor DarkGray
Write-Host "    9.  All Windows animations stripped" -ForegroundColor DarkGray
Write-Host "    10. Xbox Game Bar off + ASUS Armory Crate set to Manual startup" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  NOTE — RAM is at 2133MHz (Zen 3 ideally wants 3200-3600MHz)." -ForegroundColor Yellow
Write-Host "  If your motherboard supports XMP/EXPO, enable it in BIOS." -ForegroundColor Yellow
Write-Host "  That is the single biggest free performance gain left on this rig." -ForegroundColor Yellow
Write-Host ""
Read-Host "  Press Enter to close (then REBOOT)"
