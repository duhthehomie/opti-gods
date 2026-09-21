@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-FullRestore.ps1"

title Opti Gods by leaq  --  Full Restore / Undo All Tweaks

echo.
echo  ==========================================
echo    OPTI GODS by leaq
echo    FULL RESTORE -- Undo All Tweaks
echo    Resets everything to Windows defaults
echo  ==========================================
echo.
echo  [1/2] Extracting restore script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##PS1'+'_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Script extraction failed. Re-download from optigods.com
  echo.
  pause
  exit /b 1
)
echo  [2/2] A Windows security prompt will appear.
echo       Click "Yes" to restore Windows defaults.
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
Write-Host "  OPTI GODS by leaq -- FULL RESTORE" -ForegroundColor Red
Write-Host "  Undoes ALL Opti Gods tweaks back to Windows defaults" -ForegroundColor White
Write-Host "  Running as: $env:USERNAME" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Red
Write-Host ""

# ══════════════════════════════════════════════════════════════════
#  1. POWER PLAN — restore Balanced
# ══════════════════════════════════════════════════════════════════
Write-Host "  [1/12] Restoring power plan to Balanced..." -ForegroundColor White
powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null
# Restore CPU min to 5% (Windows default)
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 5 2>$null
powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 5 2>$null
powercfg -setdcvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 100 2>$null
powercfg -setactive SCHEME_CURRENT 2>$null
Write-Host "        OK -- Balanced power plan, CPU min restored to 5%" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  2. BOOT — restore dynamic tick
# ══════════════════════════════════════════════════════════════════
Write-Host "  [2/12] Restoring Windows boot settings..." -ForegroundColor White
bcdedit /deletevalue disabledynamictick 2>$null | Out-Null
bcdedit /deletevalue useplatformtick 2>$null | Out-Null
Write-Host "        OK -- dynamic tick restored (Windows default)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  3. CPU C-STATES — restore capabilities
# ══════════════════════════════════════════════════════════════════
Write-Host "  [3/12] Restoring CPU C-state capabilities..." -ForegroundColor White
Remove-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Processor' -Name 'Capabilities' -EA SilentlyContinue
Write-Host "        OK -- CPU Capabilities key removed (Windows manages C-states again)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  4. WIN32 PRIORITY — restore default
# ══════════════════════════════════════════════════════════════════
Write-Host "  [4/12] Restoring Win32PrioritySeparation..." -ForegroundColor White
Set-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' 'Win32PrioritySeparation' 2 -Type DWord -Force
Write-Host "        OK -- Win32PrioritySeparation=2 (Windows default)" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  5. MMCSS — restore all tasks to Windows defaults
# ══════════════════════════════════════════════════════════════════
Write-Host "  [5/12] Restoring MMCSS scheduler tasks..." -ForegroundColor White
$sp = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile'
$games = "$sp\Tasks\Games"
$audio = "$sp\Tasks\Audio"
$proAudio = "$sp\Tasks\Pro Audio"
# Games defaults
if (Test-Path $games) {
    Set-ItemProperty $games 'GPU Priority'        8        -Type DWord  -Force
    Set-ItemProperty $games 'Priority'            2        -Type DWord  -Force
    Set-ItemProperty $games 'Scheduling Category' 'High'   -Type String -Force
    Set-ItemProperty $games 'SFIO Priority'       'Normal' -Type String -Force
    Set-ItemProperty $games 'Background Only'     'False'  -Type String -Force
    Remove-ItemProperty $games 'Clock Rate' -EA SilentlyContinue
}
# Audio defaults
if (Test-Path $audio) {
    Set-ItemProperty $audio 'Scheduling Category' 'Medium'  -Type String -Force
    Set-ItemProperty $audio 'Priority'            6         -Type DWord  -Force
    Set-ItemProperty $audio 'SFIO Priority'       'Normal'  -Type String -Force
    Set-ItemProperty $audio 'Background Only'     'False'   -Type String -Force
    Remove-ItemProperty $audio 'Clock Rate' -EA SilentlyContinue
    Remove-ItemProperty $audio 'GPU Priority' -EA SilentlyContinue
}
# Pro Audio defaults
if (Test-Path $proAudio) {
    Set-ItemProperty $proAudio 'Scheduling Category' 'High'   -Type String -Force
    Set-ItemProperty $proAudio 'Priority'             6        -Type DWord  -Force
    Set-ItemProperty $proAudio 'SFIO Priority'        'Normal' -Type String -Force
    Set-ItemProperty $proAudio 'Background Only'      'False'  -Type String -Force
    Remove-ItemProperty $proAudio 'Clock Rate' -EA SilentlyContinue
    Remove-ItemProperty $proAudio 'GPU Priority' -EA SilentlyContinue
}
# Global MMCSS defaults
Set-ItemProperty $sp 'SystemResponsiveness'   20 -Type DWord -Force
Set-ItemProperty $sp 'NetworkThrottlingIndex' 10 -Type DWord -Force
Write-Host "        OK -- MMCSS Games/Audio/ProAudio restored, SystemResponsiveness=20" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  6. MEMORY MANAGER — restore defaults
# ══════════════════════════════════════════════════════════════════
Write-Host "  [6/12] Restoring memory manager defaults..." -ForegroundColor White
$mm = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management'
Set-ItemProperty $mm 'LargeSystemCache'         0 -Type DWord -Force
Remove-ItemProperty $mm 'DisablePageCombining'     -EA SilentlyContinue
Remove-ItemProperty $mm 'EncryptPagingFile'        -EA SilentlyContinue
Remove-ItemProperty $mm 'HeapDeCommitFreeBlockThreshold' -EA SilentlyContinue
Write-Host "        OK -- memory manager restored" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  7. NVMe — re-enable APST
# ══════════════════════════════════════════════════════════════════
Write-Host "  [7/12] Re-enabling NVMe power management..." -ForegroundColor White
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\stornvme\Parameters\Device' 'AllowIdlePowerManagement' -EA SilentlyContinue
Write-Host "        OK -- NVMe APST restored" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  8. NETWORK — restore adapter settings
# ══════════════════════════════════════════════════════════════════
Write-Host "  [8/12] Restoring network adapter settings..." -ForegroundColor White
Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
    $n = $_.Name
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*InterruptModeration' -RegistryValue 1 -EA SilentlyContinue
    Set-NetAdapterAdvancedProperty -Name $n -RegistryKeyword '*RSS'                 -RegistryValue 1 -EA SilentlyContinue
    Enable-NetAdapterLso -Name $n -EA SilentlyContinue
    Write-Host "        OK -- $n restored" -ForegroundColor Green
}
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' 'TCPNoDelay'     -EA SilentlyContinue
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' 'TcpAckFrequency' -EA SilentlyContinue
Write-Host "        OK -- TCP defaults restored" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  9. USB — restore selective suspend
# ══════════════════════════════════════════════════════════════════
Write-Host "  [9/12] Restoring USB selective suspend..." -ForegroundColor White
Remove-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\USB' 'DisableSelectiveSuspend' -EA SilentlyContinue
Write-Host "        OK -- USB selective suspend restored" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  10. AUDIO ENHANCEMENTS — re-enable
# ══════════════════════════════════════════════════════════════════
Write-Host "  [10/12] Restoring audio enhancements..." -ForegroundColor White
$renderPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'
if (Test-Path $renderPath) {
    Get-ChildItem $renderPath | ForEach-Object {
        $propsPath = "$($_.PSPath)\Properties"
        if (Test-Path $propsPath) {
            Set-ItemProperty $propsPath '{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5' 0 -Type DWord -Force -EA SilentlyContinue
        }
    }
    Write-Host "        OK -- audio enhancements re-enabled" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════
#  11. NVIDIA — restore MSI, PowerMizer, ASPM to defaults
# ══════════════════════════════════════════════════════════════════
Write-Host "  [11/12] Restoring NVIDIA GPU driver settings..." -ForegroundColor White
$devClass = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
$indices = (0..9 | ForEach-Object { "000$_" }) + (10..15 | ForEach-Object { "00$_" })
foreach ($idx in $indices) {
    $k = "$devClass\$idx"
    if (Test-Path $k) {
        $desc = (Get-ItemProperty $k -Name 'DriverDesc' -EA SilentlyContinue).DriverDesc
        if ($desc -match 'NVIDIA') {
            # Restore MSI to off
            $msiPath = "$k\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
            if (Test-Path $msiPath) {
                Set-ItemProperty $msiPath 'MSISupported' 0 -Type DWord -Force -EA SilentlyContinue
                Remove-ItemProperty $msiPath 'MessageNumberLimit' -EA SilentlyContinue
            }
            # Restore PowerMizer to defaults
            Remove-ItemProperty $k 'PowerMizerEnable'   -EA SilentlyContinue
            Remove-ItemProperty $k 'PowerMizerLevel'    -EA SilentlyContinue
            Remove-ItemProperty $k 'PowerMizerLevelAC'  -EA SilentlyContinue
            Remove-ItemProperty $k 'PerfLevelSrc'       -EA SilentlyContinue
            Remove-ItemProperty $k 'GpuPreferenceUA'    -EA SilentlyContinue
            Remove-ItemProperty $k 'EnableMCEReporting' -EA SilentlyContinue
            Remove-ItemProperty $k 'EnableAspmL0s'      -EA SilentlyContinue
            Remove-ItemProperty $k 'EnableAspmL1'       -EA SilentlyContinue
            # AMD keys if applicable
            Remove-ItemProperty $k 'EnableULPS'                      -EA SilentlyContinue
            Remove-ItemProperty $k 'EnableULPS_NA'                   -EA SilentlyContinue
            Remove-ItemProperty $k 'PP_ThermalAutoThrottlingEnable'  -EA SilentlyContinue
            Remove-ItemProperty $k 'KMD_EnableComputePreemption'     -EA SilentlyContinue
            Remove-ItemProperty $k 'PP_SclkDeepSleepDisable'         -EA SilentlyContinue
            Remove-ItemProperty $k 'EnableAspmL1_1'                  -EA SilentlyContinue
            Remove-ItemProperty $k 'EnableAspmL1_2'                  -EA SilentlyContinue
            Remove-ItemProperty $k 'KMD_FRTEnabled'                  -EA SilentlyContinue
            # AMD FRTC (frame rate cap) -- restore
            Remove-ItemProperty $k 'KMD_FRTCEnabled'  -EA SilentlyContinue
            Remove-ItemProperty $k 'KMD_FRTCMaxFPS'   -EA SilentlyContinue
            Write-Host "        OK -- $desc driver registry restored" -ForegroundColor Green
        }
    }
}

# ══════════════════════════════════════════════════════════════════
#  12. GAME DVR / FULLSCREEN OPTS — restore
# ══════════════════════════════════════════════════════════════════
Write-Host "  [12/12] Restoring GameDVR and fullscreen settings..." -ForegroundColor White
Remove-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_FSEBehaviorMode'                    -EA SilentlyContinue
Remove-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_HonorUserFSEBehaviorMode'            -EA SilentlyContinue
Remove-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_DXGIHonorFSEWindowsCompatible'      -EA SilentlyContinue
Remove-ItemProperty 'HKCU:\System\GameConfigStore' 'GameDVR_EFSEBehaviorMode'                   -EA SilentlyContinue
Set-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' 'AppCaptureEnabled' 1 -Type DWord -Force -EA SilentlyContinue
Remove-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR' 'AllowGameDVR'          -EA SilentlyContinue
# Restore display refresh rate control (fix for NCP not opening / 30fps display)
$graphicsDrivers = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'
Remove-ItemProperty $graphicsDrivers 'TdrDelay'   -EA SilentlyContinue
Remove-ItemProperty $graphicsDrivers 'TdrDdiDelay' -EA SilentlyContinue
# Re-register NVIDIA display container service if stopped
$nvcSvc = Get-Service -Name 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvcSvc -and $nvcSvc.StartType -eq 'Disabled') {
    Set-Service 'NVDisplay.ContainerLocalSystem' -StartupType Automatic -EA SilentlyContinue
    Start-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
    Write-Host "        OK -- NVIDIA Display Container service re-enabled and started" -ForegroundColor Green
}
$nvContSvc = Get-Service -Name 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
if ($nvContSvc -and $nvContSvc.Status -ne 'Running') {
    Start-Service 'NVDisplay.ContainerLocalSystem' -EA SilentlyContinue
}
# Restart NVIDIA services to fix NCP not opening
$nvServices = @('NVDisplay.ContainerLocalSystem','nvsvc','NvContainerLocalSystem','NvTelemetryContainer')
foreach ($svc in $nvServices) {
    $s = Get-Service -Name $svc -EA SilentlyContinue
    if ($s) {
        if ($s.StartType -eq 'Disabled') { Set-Service $svc -StartupType Automatic -EA SilentlyContinue }
        Start-Service $svc -EA SilentlyContinue
        Write-Host "        OK -- NVIDIA service '$svc' started" -ForegroundColor Green
    }
}
Write-Host "        OK -- GameDVR restored, fullscreen opts restored, NVIDIA services restarted" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  ======================================================" -ForegroundColor Red
Write-Host "   OPTI GODS -- Full Restore Complete" -ForegroundColor White
Write-Host "   All tweaks undone. Windows defaults restored." -ForegroundColor DarkGray
Write-Host "  ======================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  REBOOT REQUIRED to fully apply boot + GPU changes." -ForegroundColor Cyan
Write-Host ""
Write-Host "  After reboot:" -ForegroundColor Yellow
Write-Host "    - NVIDIA Control Panel should open normally" -ForegroundColor White
Write-Host "    - Refresh rate will be back to your monitor's native" -ForegroundColor White
Write-Host "    - Performance will be Windows stock defaults" -ForegroundColor White
Write-Host ""
Read-Host "  Press Enter to close"
