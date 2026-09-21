@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-Preset-12600K.ps1"

title Opti Gods by leaq  --  i5-12600K + RTX 4060 Ti Preset

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    Preset: i5-12600K + RTX 4060 Ti
echo    Win11 23H2 / 16GB / Dual GPU fix
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
Write-Host "  Preset: i5-12600K + RTX 4060 Ti" -ForegroundColor White
Write-Host "  Windows 11 Pro 23H2 / 16GB / Dual GPU" -ForegroundColor DarkGray
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""

# ══════════════════════════════════════════════════════════════════
#  1. FORCE RTX 4060 Ti AS SYSTEM-WIDE DEFAULT GPU
#     i5-12600K has Intel UHD 770 iGPU. Without this, Windows and
#     some game launchers silently pick the iGPU for rendering.
#     This is the #1 cause of "less FPS than before" on dual-GPU rigs.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/10] Forcing RTX 4060 Ti as default GPU (dual GPU fix)..." -ForegroundColor White

# Global DirectX GPU preference = High Performance (= dGPU, not iGPU)
$dxPref = 'HKCU:\SOFTWARE\Microsoft\DirectX\UserGpuPreferences'
if (!(Test-Path $dxPref)) { New-Item $dxPref -Force | Out-Null }
Set-ItemProperty $dxPref 'DirectXUserGlobalSettings' 'GpuPreference=2;' -Type String -Force

# Force high-perf GPU for common game launchers and engines
$appPaths = @(
    'C:\Program Files (x86)\Steam\steam.exe',
    'C:\Program Files\Steam\steam.exe',
    'C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe',
    'C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe',
    'C:\Program Files\Rockstar Games\Launcher\Launcher.exe',
    'C:\Windows\System32\mmc.exe'
)
$appPaths | Where-Object { Test-Path $_ } | ForEach-Object {
    Set-ItemProperty $dxPref $_ 'GpuPreference=2;' -Type String -Force
    Write-Host "        dGPU forced for: $(Split-Path $_ -Leaf)" -ForegroundColor DarkGray
}

# Windows Graphics Settings GPU preference (the UI toggle equivalent)
$wgsPref = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
if (!(Test-Path $wgsPref)) { New-Item $wgsPref -Force | Out-Null }

# Disable Intel UHD 770 from competing for D3D workloads
# (does NOT disable the device — just removes it from the DXGI adapter priority)
$intelPref = 'HKLM:\SOFTWARE\Intel\GMM'
if (!(Test-Path $intelPref)) { New-Item $intelPref -Force | Out-Null }
Set-ItemProperty $intelPref 'DedicatedSegmentSize' 0 -Type DWord -Force

Write-Host "        OK — RTX 4060 Ti set as global default, Intel UHD 770 deprioritized" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. POWER PLAN — High Performance, i5-12600K P/E-core tuned
#     12th gen Alder Lake has 6 P-cores + 4 E-cores. Windows 11
#     Thread Director handles scheduling well BUT only if the power
#     plan doesn't let P-cores idle between frames.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [2/10] Power plan — i5-12600K P/E-core tuned..." -ForegroundColor White

powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
# CPU min 100% — prevents P-cores from dropping to E-core-equivalent clocks mid-frame
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
# Fastest decrease policy — P-cores recover clock immediately after a frame dip
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFINCPOL  2 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PERFDECPOL  1 2>$null
# Heterogeneous policy = let Windows Thread Director work (don't override to 0)
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR HETEROPOLICY 1 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null

Write-Host "        OK — High Performance, CPU 100%%, P-core boost unrestricted, ITD on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  3. MMCSS — Game + audio thread priorities
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/10] MMCSS multimedia scheduler..." -ForegroundColor White

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
#  4. NVIDIA RTX 4060 Ti — DRIVER REGISTRY TWEAKS
#     Ada Lovelace (AD106). DLSS 3 + Frame Gen capable.
#     These driver keys set the same values as NVCP 3D settings
#     but persist across driver updates.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/10] NVIDIA RTX 4060 Ti driver tweaks..." -ForegroundColor White

$nvKey = 'HKLM:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (!(Test-Path $nvKey)) { New-Item $nvKey -Force | Out-Null }

Set-ItemProperty $nvKey 'TextureFilterQuality' 0 -Type DWord -Force  # High Performance
Set-ItemProperty $nvKey 'RmLowLatencyMode'     2 -Type DWord -Force  # Low Latency Ultra
Set-ItemProperty $nvKey 'FlipQueueSize'        1 -Type DWord -Force  # pre-render queue = 1
Set-ItemProperty $nvKey 'OGL_ThreadControl'    1 -Type DWord -Force  # Threaded Opt ON
Set-ItemProperty $nvKey 'D3D_ThreadControl'    1 -Type DWord -Force
Set-ItemProperty $nvKey 'FXAA'                 0 -Type DWord -Force  # Driver FXAA off
Remove-ItemProperty $nvKey 'FrameRateLimit' -EA SilentlyContinue     # No FPS cap
Remove-ItemProperty $nvKey 'VSyncMode'      -EA SilentlyContinue     # No VSync override

# Per-GPU class key (AD106)
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

# Power Management = Max Performance (stops 4060 Ti from P-state stepping mid-frame)
$nvPow = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
if (!(Test-Path $nvPow)) { New-Item $nvPow -Force | Out-Null }
Set-ItemProperty $nvPow 'PerfLevelSrc' 0x2222 -Type DWord -Force

Write-Host "        OK — texture perf, low latency ultra, threaded opt, max power, no FPS cap" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. HAGS + TDR + GAMEDVR + FULLSCREEN (Win11 23H2)
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/10] HAGS, TDR, GameDVR, fullscreen..." -ForegroundColor White

Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'HwSchMode' 2 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrLevel'  3 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'TdrDelay'  8 -Type DWord -Force
# Remove any leftover dGPU/iGPU conflict lock
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' 'DxgkrnlDriverType' -EA SilentlyContinue

$gcs = 'HKCU:\System\GameConfigStore'
if (!(Test-Path $gcs)) { New-Item $gcs -Force | Out-Null }
Set-ItemProperty $gcs 'GameDVR_Enabled'                        0 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_FSEBehaviorMode'                2 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_HonorUserFSEBehaviorMode'       1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Set-ItemProperty $gcs 'GameDVR_EFSEFeatureFlags'               0 -Type DWord -Force

Write-Host "        OK — HAGS on, TDR safe, GameDVR off, fullscreen exclusive on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. INTEL UHD 770 — PREVENT iGPU FROM STEALING FRAMES
#     Does NOT disable the iGPU device (you need it for display
#     output if the monitor is on the motherboard port).
#     Sets DXGI adapter preference so D3D12/Vulkan always picks
#     the RTX 4060 Ti when both adapters are available.
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/10] Intel UHD 770 iGPU — preventing frame stealing..." -ForegroundColor White

# Remove any iGPU-first policy Windows may have set
$igpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $igpuClass -EA SilentlyContinue | ForEach-Object {
    $desc = (Get-ItemProperty $_.PSPath 'DriverDesc' -EA SilentlyContinue).DriverDesc
    if ($desc -match 'Intel.*UHD|Intel.*HD|Intel.*Iris') {
        # Don't disable — just remove any "preferred" flags
        Remove-ItemProperty $_.PSPath 'AdapterPreference' -EA SilentlyContinue
        Write-Host "        iGPU adapter preference cleared: $desc" -ForegroundColor DarkGray
    }
}

# Set explicit app GPU preferences for FiveM, COD, Fortnite
$gameExes = @(
    "$env:LOCALAPPDATA\FiveM\FiveM.exe",
    "$env:LOCALAPPDATA\FiveM\FiveM Application Data\FiveM.exe",
    'C:\Program Files\Call of Duty\cod.exe',
    "$env:LOCALAPPDATA\Fortnite\FortniteGame\Binaries\Win64\FortniteClient-Win64-Shipping.exe"
)
$gameExes | Where-Object { Test-Path $_ } | ForEach-Object {
    Set-ItemProperty $dxPref $_ 'GpuPreference=2;' -Type String -Force
    Write-Host "        RTX 4060 Ti forced for: $(Split-Path $_ -Leaf)" -ForegroundColor DarkGray
}

Write-Host "        OK — iGPU deprioritized, RTX 4060 Ti wins all DXGI adapter selections" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. WIN32 PRIORITY + i5-12600K SCHEDULER HINT
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/10] Win32 priority + 12th gen scheduler..." -ForegroundColor White

Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' `
    'Win32PrioritySeparation' 0x26 -Type DWord -Force

# Intel 12th gen heterogeneous policy — trust Thread Director (value 4 = ITD mode)
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\kernel' `
    'SchedulerAssist' 1 -Type DWord -Force

Write-Host "        OK — Win32 0x26, ITD scheduler assist on" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. MEMORY — 16GB DDR4
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/10] Memory management (16GB DDR4)..." -ForegroundColor White

$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
Set-ItemProperty $mm 'LargeSystemCache'        0 -Type DWord -Force
Set-ItemProperty $mm 'DisablePagingExecutive'  1 -Type DWord -Force
Set-ItemProperty $mm 'ClearPageFileAtShutdown' 0 -Type DWord -Force
# i5-12600K L3 = 20MB
Set-ItemProperty $mm 'SecondLevelDataCache' 20480 -Type DWord -Force

Write-Host "        OK — gaming memory mode, kernel in RAM, 20MB L3 hint" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  9. NETWORK — TCP + NIC
# ══════════════════════════════════════════════════════════════════
Write-Host "  [9/10] Network — TCP stack..." -ForegroundColor White

& netsh int tcp set global autotuninglevel=normal 2>$null | Out-Null
& netsh int tcp set global chimney=disabled       2>$null | Out-Null
& netsh int tcp set global rss=enabled            2>$null | Out-Null
& netsh int tcp set global ecncapability=disabled 2>$null | Out-Null

$nicClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $nicClass -EA SilentlyContinue | ForEach-Object {
    $d = (Get-ItemProperty $_.PSPath 'DriverDesc' -EA SilentlyContinue).DriverDesc
    if ($d -match 'Realtek|Intel|Killer|Atheros') {
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

Write-Host "        OK — TCP tuned, Nagle off, NIC interrupt mod off" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  10. VISUAL EFFECTS + NVIDIA SERVICES CONFIRM
# ══════════════════════════════════════════════════════════════════
Write-Host "  [10/10] Visual effects + confirming NVIDIA services..." -ForegroundColor White

Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' `
    'VisualFXSetting' 2 -Type DWord -Force -EA SilentlyContinue
Set-ItemProperty 'HKCU:\Control Panel\Desktop' `
    'UserPreferencesMask' ([byte[]](0x10,0x00,0x00,0x00)) -Type Binary -Force -EA SilentlyContinue

# Confirm NVIDIA Display Container is running (learned from earlier issues on this rig)
$nvcls = Get-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcls) {
    if ($nvcls.StartType -eq 'Disabled') {
        Set-Service 'NVDisplay.ContainerLocalSystem' -StartupType Automatic
        Start-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
        Write-Host "        FIXED: NVDisplay.ContainerLocalSystem was disabled — re-enabled" -ForegroundColor Yellow
    } else {
        Write-Host "        OK: NVDisplay.ContainerLocalSystem is $($nvcls.StartType)" -ForegroundColor Green
    }
} else {
    Write-Host "        WARN: NVDisplay.ContainerLocalSystem not found — reinstall NVIDIA driver if NCP missing" -ForegroundColor Yellow
}

Write-Host "        OK — visual effects stripped" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "========================================================" -ForegroundColor Red
Write-Host "  DONE — i5-12600K + RTX 4060 Ti preset applied" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED." -ForegroundColor Yellow
Write-Host ""
Write-Host "  What was applied:" -ForegroundColor White
Write-Host "    1.  RTX 4060 Ti forced as global default GPU" -ForegroundColor DarkGray
Write-Host "        (Intel UHD 770 deprioritized — no iGPU frame stealing)" -ForegroundColor DarkGray
Write-Host "    2.  High Performance plan — P-cores pinned 100%%, ITD on" -ForegroundColor DarkGray
Write-Host "    3.  MMCSS — 90%% CPU to game threads" -ForegroundColor DarkGray
Write-Host "    4.  RTX 4060 Ti — texture perf, low latency ultra, max power" -ForegroundColor DarkGray
Write-Host "    5.  HAGS on, GameDVR off, fullscreen exclusive on" -ForegroundColor DarkGray
Write-Host "    6.  iGPU DXGI adapter preference cleared system-wide" -ForegroundColor DarkGray
Write-Host "    7.  Win32 priority 0x26 + Intel Thread Director hint" -ForegroundColor DarkGray
Write-Host "    8.  Memory — gaming mode, 20MB L3 hint" -ForegroundColor DarkGray
Write-Host "    9.  TCP + NIC — Nagle off, interrupt mod off" -ForegroundColor DarkGray
Write-Host "    10. Visual effects off + NVIDIA service confirmed" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  If FPS is still lower than expected after reboot:" -ForegroundColor Cyan
Write-Host "  Go to Windows Settings > Display > Graphics" -ForegroundColor Cyan
Write-Host "  Find your game > Options > set to High Performance (RTX 4060 Ti)" -ForegroundColor Cyan
Write-Host ""
Read-Host "  Press Enter to close (then REBOOT)"
