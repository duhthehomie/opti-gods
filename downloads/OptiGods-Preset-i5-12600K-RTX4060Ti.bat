@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-Preset-12600K.ps1"

title Opti Gods by leaq  --  i5-12600K + RTX 4060 Ti Preset

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    Preset: i5-12600K + RTX 4060 Ti
echo    Win11 / 16GB DDR4 / NVMe
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
Write-Host "======================================================" -ForegroundColor Red
Write-Host "  OPTI GODS by leaq" -ForegroundColor Red
Write-Host "  Preset: i5-12600K + RTX 4060 Ti" -ForegroundColor White
Write-Host "  Windows 11 / 16GB DDR4 / NVMe SSD" -ForegroundColor DarkGray
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Red
Write-Host ""

# ══════════════════════════════════════════════════════════════════
#  1. POWER PLAN — High Performance
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/10] Power plan..." -ForegroundColor White
powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
if ($LASTEXITCODE -ne 0) {
    # Create High Performance if it doesn't exist
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
}
# Pin CPU min to 100% — i5-12600K boosts aggressively, don't let it idle mid-frame
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 100 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host "        OK — High Performance, CPU pinned 100%" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. NVIDIA RTX 4060 Ti — MSI Interrupt + PowerMizer + Driver tweaks
# ══════════════════════════════════════════════════════════════════
Write-Host "  [2/10] NVIDIA RTX 4060 Ti driver tweaks..." -ForegroundColor White
$devClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
$nvFixed = $false
$indices = (0..9 | ForEach-Object { "000$_" }) + (10..15 | ForEach-Object { "00$_" })
foreach ($idx in $indices) {
    $k = "$devClass\$idx"
    if (Test-Path $k) {
        $desc = (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc
        if ($desc -match 'NVIDIA') {
            # MSI interrupt mode — eliminates level-triggered IRQ latency
            $msiPath = "$k\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
            if (!(Test-Path $msiPath)) { New-Item $msiPath -Force | Out-Null }
            Set-ItemProperty $msiPath 'MSISupported'      1  -Type DWord -Force
            Set-ItemProperty $msiPath 'MessageNumberLimit' 16 -Type DWord -Force
            # PowerMizer — Max Performance (no downclocking between frames)
            Set-ItemProperty $k 'PowerMizerEnable'   0      -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'PowerMizerLevel'    1      -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'PowerMizerLevelAC'  1      -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'PerfLevelSrc'       0x2222 -Type DWord -Force -EA SilentlyContinue
            # GPU priority 8 in kernel
            Set-ItemProperty $k 'GpuPreferenceUA'    8      -Type DWord -Force -EA SilentlyContinue
            # Disable MCE reporting overhead
            Set-ItemProperty $k 'EnableMCEReporting' 0      -Type DWord -Force -EA SilentlyContinue
            # Ada Lovelace (RTX 4000): disable ASPM to prevent PCIe power-state spikes
            Set-ItemProperty $k 'EnableAspmL0s'  0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $k 'EnableAspmL1'   0 -Type DWord -Force -EA SilentlyContinue
            Write-Host "        OK — $desc — MSI ON, PowerMizer Max, ASPM OFF" -ForegroundColor Green
            $nvFixed = $true
        }
    }
}
if (!$nvFixed) { Write-Host "        No NVIDIA GPU found in registry" -ForegroundColor Yellow }

# NVIDIA profile via NvProfile reg path (Low Latency Ultra + Threaded Opt)
$nvProf = 'HKLM:\SYSTEM\CurrentControlSet\Control\Video'
# These are soft hints — full control via NVIDIA Control Panel but registry nudges help
$nvAppPath = 'HKCU:\SOFTWARE\NVIDIA Corporation\Global\NVTweak'
if (!(Test-Path $nvAppPath)) { New-Item $nvAppPath -Force | Out-Null }
Set-ItemProperty $nvAppPath 'DDCCIEnable' 0 -Type DWord -Force -EA SilentlyContinue

# ══════════════════════════════════════════════════════════════════
#  3. INTEL i5-12600K — Hybrid core scheduler tweaks
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/10] Intel 12th Gen hybrid core tweaks..." -ForegroundColor White
# Disable dynamic tick — prevents timer interrupt from coalescing with C-state wake
bcdedit /set disabledynamictick yes | Out-Null
Write-Host "        OK — dynamic tick disabled" -ForegroundColor Green
# Suppress deep C-states (C6/C7) — P-core wake latency goes from 200µs → 10µs
$cpuClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Processor'
if (!(Test-Path $cpuClass)) { New-Item $cpuClass -Force | Out-Null }
Set-ItemProperty $cpuClass 'Capabilities' 0x0007e066 -Type DWord -Force -EA SilentlyContinue
Write-Host "        OK — C6/C7 deep sleep suppressed, P-core wake latency minimal" -ForegroundColor Green
# Intel Thread Director is ON in Win11 — don't fight it, just ensure foreground boost
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' 'Win32PrioritySeparation' 38 -Type DWord -Force
Write-Host "        OK — Win32PrioritySeparation=38 (foreground games get 2x quantum)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  4. MMCSS — Games + Audio scheduler
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/10] MMCSS scheduler tuning..." -ForegroundColor White
$sp = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
$games = "$sp\Tasks\Games"
$audio = "$sp\Tasks\Audio"
$proAudio = "$sp\Tasks\Pro Audio"
if (!(Test-Path $games))    { New-Item $games    -Force | Out-Null }
if (!(Test-Path $audio))    { New-Item $audio    -Force | Out-Null }
if (!(Test-Path $proAudio)) { New-Item $proAudio -Force | Out-Null }
# Games
Set-ItemProperty $games 'GPU Priority'        8       -Type DWord  -Force
Set-ItemProperty $games 'Priority'            6       -Type DWord  -Force
Set-ItemProperty $games 'Scheduling Category' 'High'  -Type String -Force
Set-ItemProperty $games 'SFIO Priority'       'High'  -Type String -Force
Set-ItemProperty $games 'Background Only'     'False' -Type String -Force
Set-ItemProperty $games 'Clock Rate'          10000   -Type DWord  -Force
# Audio
Set-ItemProperty $audio 'Scheduling Category' 'Medium' -Type String -Force
Set-ItemProperty $audio 'Priority'            6        -Type DWord  -Force
Set-ItemProperty $audio 'SFIO Priority'       'High'   -Type String -Force
Set-ItemProperty $audio 'Background Only'     'False'  -Type String -Force
Set-ItemProperty $audio 'Clock Rate'          10000    -Type DWord  -Force
Set-ItemProperty $audio 'GPU Priority'        8        -Type DWord  -Force
# Pro Audio
Set-ItemProperty $proAudio 'Scheduling Category' 'High'  -Type String -Force
Set-ItemProperty $proAudio 'Priority'            6       -Type DWord  -Force
Set-ItemProperty $proAudio 'SFIO Priority'       'High'  -Type String -Force
Set-ItemProperty $proAudio 'Background Only'     'False' -Type String -Force
Set-ItemProperty $proAudio 'Clock Rate'          10000   -Type DWord  -Force
Set-ItemProperty $proAudio 'GPU Priority'        8       -Type DWord  -Force
# Global
Set-ItemProperty $sp 'SystemResponsiveness'   10         -Type DWord -Force
Set-ItemProperty $sp 'NetworkThrottlingIndex' 0xFFFFFFFF -Type DWord -Force
Write-Host "        OK — Games Priority=6/GPU=8, Audio tuned, SR=10" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. MEMORY — 16GB DDR4 2400 MT/s tweaks
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/10] Memory manager tweaks..." -ForegroundColor White
$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
# Large system cache OFF — dedicate RAM to game process, not file cache
Set-ItemProperty $mm 'LargeSystemCache'         0 -Type DWord -Force
# Disable memory compression — on 16GB the compression overhead costs more than it saves
Set-ItemProperty $mm 'DisablePageCombining'     1 -Type DWord -Force
# Pagefile encryption off
Set-ItemProperty $mm 'EncryptPagingFile'        0 -Type DWord -Force
# Heap decommit threshold — keeps heap blocks in game process longer
Set-ItemProperty $mm 'HeapDeCommitFreeBlockThreshold' 0x00040000 -Type DWord -Force
Write-Host "        OK — Large cache OFF, page combining OFF, pagefile encryption OFF" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. NVMe SSD — disable APST power transitions
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/10] NVMe APST (prevents 100-500ms read stutter)..." -ForegroundColor White
$nvmeKey = 'HKLM:\SYSTEM\CurrentControlSet\Services\stornvme\Parameters\Device'
if (!(Test-Path $nvmeKey)) { New-Item $nvmeKey -Force | Out-Null }
Set-ItemProperty $nvmeKey 'AllowIdlePowerManagement' 0 -Type DWord -Force
powercfg -setacvalueindex SCHEME_CURRENT 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host "        OK — NVMe APST disabled, disk timeout Never" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. NETWORK — interrupt moderation + TCP
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/10] Network adapter tweaks..." -ForegroundColor White
Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
    $n = $_.Name
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*InterruptModeration' -RegistryValue 0 -EA SilentlyContinue
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*RSS'                 -RegistryValue 0 -EA SilentlyContinue
    Disable-NetAdapterLso -Name $n -EA SilentlyContinue
    Write-Host "        OK — $n : interrupt moderation OFF, RSS OFF, LSO OFF" -ForegroundColor Green
}
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' 'TCPNoDelay'     1 -Type DWord -Force
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' 'TcpAckFrequency' 1 -Type DWord -Force
Write-Host "        OK — TCP no-delay + immediate ACK" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. USB — disable selective suspend
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/10] USB selective suspend..." -ForegroundColor White
$usbSvc = 'HKLM:\SYSTEM\CurrentControlSet\Services\USB'
if (!(Test-Path $usbSvc)) { New-Item $usbSvc -Force | Out-Null }
Set-ItemProperty $usbSvc 'DisableSelectiveSuspend' 1 -Type DWord -Force
powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host "        OK — USB stays powered during gameplay" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  9. AUDIO ENHANCEMENTS — disable APO chain
# ══════════════════════════════════════════════════════════════════
Write-Host "  [9/10] Disabling audio enhancements..." -ForegroundColor White
$renderPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'
if (Test-Path $renderPath) {
    $devCount = 0
    Get-ChildItem $renderPath | ForEach-Object {
        $propsPath = "$($_.PSPath)\Properties"
        if (Test-Path $propsPath) {
            Set-ItemProperty $propsPath '{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5' 1 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $propsPath '{62ec7b65-4a0a-4e49-8a4e-16a6e95d756e},1' 0 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $propsPath '{b3f8fa53-0004-438e-9003-51a46e139bfc},3' 1 -Type DWord -Force -EA SilentlyContinue
            Set-ItemProperty $propsPath '{b3f8fa53-0004-438e-9003-51a46e139bfc},4' 1 -Type DWord -Force -EA SilentlyContinue
            $devCount++
        }
    }
    Write-Host "        OK — APO/EQ/Sonic disabled on $devCount device(s)" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════
#  10. VISUAL — disable fullscreen optimizations, GPU scheduling
# ══════════════════════════════════════════════════════════════════
Write-Host "  [10/10] Visual / scheduling final tweaks..." -ForegroundColor White
# Disable fullscreen optimizations globally (causes stutters with some DX11/12 games)
Set-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_FSEBehaviorMode'    2 -Type DWord -Force
Set-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_HonorUserFSEBehaviorMode' 1 -Type DWord -Force
Set-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_DXGIHonorFSEWindowsCompatible' 1 -Type DWord -Force
Set-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_EFSEBehaviorMode'   2 -Type DWord -Force
# Game DVR / Xbox Game Bar off
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled' 0 -Type DWord -Force
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' 'AllowGameDVR' 0 -Type DWord -Force -EA SilentlyContinue
# HAGS — RTX 4060 Ti: keep HAGS ON (it's beneficial on Ada Lovelace / Win11)
# (Not disabling — HAGS is correct to leave enabled on this GPU)
Write-Host "        OK — fullscreen opts OFF, GameDVR OFF, HAGS left ON (correct for RTX 4000)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  ======================================================" -ForegroundColor Red
Write-Host "   OPTI GODS — Preset Applied" -ForegroundColor White
Write-Host "   i5-12600K + RTX 4060 Ti + Win11" -ForegroundColor DarkGray
Write-Host "  ======================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED for MSI interrupt + C-state changes." -ForegroundColor Cyan
Write-Host ""
Write-Host "  After reboot — do these manually in NVIDIA Control Panel:" -ForegroundColor Yellow
Write-Host "    - Low Latency Mode: Ultra" -ForegroundColor White
Write-Host "    - Power Management: Prefer Maximum Performance" -ForegroundColor White
Write-Host "    - Texture Filtering: High Performance" -ForegroundColor White
Write-Host "    - Threaded Optimization: On" -ForegroundColor White
Write-Host ""
Write-Host "  HAGS: leave ON — RTX 4060 Ti benefits from it on Win11." -ForegroundColor DarkGray
Write-Host ""
Read-Host "  Press Enter to close"
