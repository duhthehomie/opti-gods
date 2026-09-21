@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-Preset-i54590v2.ps1"

title Opti Gods by leaq  --  i5-4590 + RTX 2060 Preset V2

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    Preset: i5-4590 + RTX 2060  [V2 FIX]
echo    Win10 / 16GB DDR3 / Desktop
echo    Reverts last preset + applies correct
echo  ==========================================
echo.
echo  [1/2] Extracting preset script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
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
Write-Host "  Preset V2: i5-4590 + RTX 2060  [FPS FIX]" -ForegroundColor White
Write-Host "  Windows 10 Pro / 16GB DDR3 / Desktop" -ForegroundColor DarkGray
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  Step 0: Reverting last preset's harmful changes first..." -ForegroundColor Yellow
Write-Host ""

# ══════════════════════════════════════════════════════════════════
#  0. UNDO LAST PRESET — revert anything that hurt FPS
#     HAGS (HwSchMode=2) is the main culprit on old B85/Haswell.
#     i5-4590 + B85 chipset is too old for HAGS — it causes
#     microstutter and inconsistent frametimes on Win10.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [0/8] Reverting previous preset changes that hurt FPS..." -ForegroundColor White

# DISABLE HAGS — this is almost certainly what caused worse FPS
# On i5-4590 + B85 + Win10, HAGS = microstutter. Set back to off.
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 0 -Type DWord -Force
Write-Host "        HAGS disabled (was the FPS killer on old Haswell/B85)" -ForegroundColor Yellow

# Revert DisablePagingExecutive — 16GB DDR3 1333MHz is slow enough
# that keeping kernel in RAM causes GC pressure on Win10
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management' `
    'DisablePagingExecutive' 0 -Type DWord -Force
Write-Host "        DisablePagingExecutive reverted (old DDR3 rig needs this)" -ForegroundColor Yellow

# Revert visual effects — Win10 on old hardware sometimes renders
# more efficiently with default effects than stripped-out mode
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' `
    'VisualFXSetting' 3 -Type DWord -Force -EA SilentlyContinue
Write-Host "        Visual effects reset to Windows default" -ForegroundColor Yellow

Write-Host "        OK — last preset damage undone" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  1. POWER PLAN — High Performance, CPU pinned 100%
#     i5-4590: 4C/4T no HT, 3.3GHz base / 3.7GHz boost.
#     Pinning min to 100% stops the base clock from idling to
#     1.2GHz between frames on the default Balanced plan.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/8] Power plan — High Performance..." -ForegroundColor White

powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
# Hard disk sleep = never
powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null

Write-Host "        OK — High Performance, CPU 100%%, disk sleep off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. MMCSS — Multimedia scheduler (safe on all Win10 hardware)
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

Write-Host "        OK — 90%% CPU to game threads, UDP throttle removed" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  3. NVIDIA RTX 2060 — DRIVER TWEAKS (no HAGS dependency)
#     These write directly to NVIDIA's own NVTweak registry path —
#     equivalent to NVCP 3D settings but survive driver updates.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/8] NVIDIA RTX 2060 driver tweaks..." -ForegroundColor White

$nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }
Set-ItemProperty $nvKey 'TextureFilterQuality' 0 -Type DWord -Force  # High Performance
Set-ItemProperty $nvKey 'RmLowLatencyMode'     2 -Type DWord -Force  # Low Latency Ultra
Set-ItemProperty $nvKey 'FlipQueueSize'        1 -Type DWord -Force  # pre-render = 1 frame
Set-ItemProperty $nvKey 'OGL_ThreadControl'    1 -Type DWord -Force  # Threaded Opt ON
Set-ItemProperty $nvKey 'D3D_ThreadControl'    1 -Type DWord -Force
Set-ItemProperty $nvKey 'FXAA'                 0 -Type DWord -Force  # Driver FXAA off
Remove-ItemProperty $nvKey 'FrameRateLimit' -EA SilentlyContinue
Remove-ItemProperty $nvKey 'VSyncMode'      -EA SilentlyContinue

# Per-GPU class key
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

# Power Management = Prefer Max Performance (PerfLevelSrc 0x2222 = force P0)
$nvPow = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
if (!(Test-Path $nvPow)) { New-Item $nvPow -Force | Out-Null }
Set-ItemProperty $nvPow 'PerfLevelSrc' 0x2222 -Type DWord -Force

Write-Host "        OK — texture perf, low latency ultra, threaded opt, max power, no cap" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  4. TDR SAFE + GAMEDVR + FULLSCREEN
#     HAGS stays OFF. TDR at safe defaults for old platform.
#     GameDVR off = no background capture overhead on 4-core CPU.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/8] TDR safe defaults, GameDVR off, fullscreen..." -ForegroundColor White

# HAGS confirmed OFF (set in step 0, confirm here)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 0 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrLevel'  3 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrDelay'  8 -Type DWord -Force
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'DxgkrnlDriverType' -EA SilentlyContinue

$gcs = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $gcs)) { New-Item $gcs -Force | Out-Null }
Set-ItemProperty $gcs 'GameDVR_Enabled'                        0 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_FSEBehaviorMode'                2 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_HonorUserFSEBehaviorMode'       1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_EFSEFeatureFlags'               0 -Type DWord -Force

# Win10 Game Mode on — helps on 4-core CPU
$gm = 'HKCU:\SOFTWARE\Microsoft\GameBar'
if (!(Test-Path $gm)) { New-Item $gm -Force | Out-Null }
Set-ItemProperty $gm 'AutoGameModeEnabled'       1 -Type DWord -Force
Set-ItemProperty $gm 'AllowAutoGameMode'         1 -Type DWord -Force
Set-ItemProperty $gm 'UseNexusForGameBarEnabled' 0 -Type DWord -Force

Write-Host "        OK — HAGS OFF, TDR safe, GameDVR off, FSE on, Game Mode on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. WIN32 PRIORITY SEPARATION
#     0x26 = max foreground boost. Critical on 4C/4T no-HT CPU —
#     every CPU quantum needs to go to the game thread.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/8] Win32 priority separation..." -ForegroundColor White
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' `
    'Win32PrioritySeparation' 0x26 -Type DWord -Force
Write-Host "        OK — 0x26: max foreground boost (essential on 4-core no-HT)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. MEMORY — conservative settings for DDR3 1333MHz
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/8] Memory — DDR3 1333MHz safe settings..." -ForegroundColor White

$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
Set-ItemProperty $mm 'LargeSystemCache'        0 -Type DWord -Force   # gaming: no FS cache bloat
Set-ItemProperty $mm 'ClearPageFileAtShutdown' 0 -Type DWord -Force   # faster shutdown
# DisablePagingExecutive stays at 0 (reverted in step 0 — DDR3 1333 needs page headroom)
# i5-4590 L3 = 6MB
Set-ItemProperty $mm 'SecondLevelDataCache' 6144 -Type DWord -Force

Write-Host "        OK — LargeSystemCache off, 6MB L3 hint, pagefile intact" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. NETWORK — Realtek NIC + TCP
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/8] Network — Realtek NIC + TCP..." -ForegroundColor White

& netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
& netsh int tcp set global chimney=disabled       2>$null | Out-Null
& netsh int tcp set global rss=enabled            2>$null | Out-Null
& netsh int tcp set global ecncapability=disabled 2>$null | Out-Null

$nicClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nicClass -EA SilentlyContinue | ForEach-Object {
    $d = (Get-ItemProperty $_.PSPath 'DriverDesc' -EA SilentlyContinue).DriverDesc
    if ($d -match 'Realtek|RTL') {
        Set-ItemProperty $_.PSPath '*InterruptModeration' 0 -Type String -Force -EA SilentlyContinue
        Set-ItemProperty $_.PSPath '*RSS'                 1 -Type String -Force -EA SilentlyContinue
        Write-Host "        Realtek NIC tuned: $d" -ForegroundColor DarkGray
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

Write-Host "        OK — Nagle off, interrupt mod off, TCP tuned" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. NVIDIA SERVICES CONFIRM
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/8] Confirming NVIDIA services..." -ForegroundColor White

$nvcls = Get-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcls) {
    if ($nvcls.StartType -eq 'Disabled') {
        Set-Service 'NVDisplay.ContainerLocalSystem' -StartupType Automatic
        Start-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
        Write-Host "        FIXED: NVDisplay.ContainerLocalSystem was disabled — re-enabled" -ForegroundColor Yellow
    } else {
        Write-Host "        OK: NVDisplay.ContainerLocalSystem — $($nvcls.StartType)" -ForegroundColor Green
    }
}

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  DONE — i5-4590 + RTX 2060 V2 preset applied" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED." -ForegroundColor Yellow
Write-Host ""
Write-Host "  What this fixed vs last preset:" -ForegroundColor White
Write-Host "    HAGS disabled — it was causing microstutter on your" -ForegroundColor Red
Write-Host "    old B85 + Haswell platform. This is the FPS killer." -ForegroundColor Red
Write-Host ""
Write-Host "  What was applied:" -ForegroundColor White
Write-Host "    0.  Reverted HAGS, DisablePagingExecutive, visual effects" -ForegroundColor DarkGray
Write-Host "    1.  High Performance plan — CPU 100%%, disk sleep off" -ForegroundColor DarkGray
Write-Host "    2.  MMCSS — 90%% CPU to game threads" -ForegroundColor DarkGray
Write-Host "    3.  RTX 2060 — texture perf, low latency ultra, max power" -ForegroundColor DarkGray
Write-Host "    4.  HAGS OFF, TDR safe, GameDVR off, FSE on, Game Mode on" -ForegroundColor DarkGray
Write-Host "    5.  Win32 priority 0x26 — max foreground boost" -ForegroundColor DarkGray
Write-Host "    6.  Memory — LargeSystemCache off, 6MB L3 hint" -ForegroundColor DarkGray
Write-Host "    7.  Nagle off, Realtek NIC tuned" -ForegroundColor DarkGray
Write-Host "    8.  NVIDIA services confirmed" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Note: RAM at DDR3 1333MHz is the main bottleneck on" -ForegroundColor Cyan
Write-Host "  this rig. BIOS XMP to 1600MHz = biggest single upgrade." -ForegroundColor Cyan
Write-Host ""
Read-Host "  Press Enter to close (then REBOOT)"
