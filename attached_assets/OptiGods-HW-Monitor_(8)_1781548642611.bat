@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-HW-Monitor.ps1"

title Opti Gods by leaq  --  Hardware Monitor

PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##HW_MONITOR_P'+'S1_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"

if not exist "%TMPPS1%" (
  echo  [ERROR] Extraction failed. Re-download the BAT from the app.
  pause
  exit /b 1
)

PowerShell -NoProfile -ExecutionPolicy Bypass -File "%TMPPS1%"
del "%TMPPS1%" 2>nul
echo.
pause
exit /b 0
##HW_MONITOR_PS1_START##
$ErrorActionPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Red
Write-Host "    OPTI GODS by leaq  --  Hardware Monitor" -ForegroundColor White
Write-Host "  ================================================" -ForegroundColor Red
Write-Host ""
Write-Host "  Collecting sensor data..." -ForegroundColor DarkGray
Write-Host ""

$result = [ordered]@{}

# GPU via nvidia-smi
$smiExe = $null
$smiCmd = Get-Command "nvidia-smi.exe" -EA SilentlyContinue
if ($smiCmd) { $smiExe = $smiCmd.Source }
else {
    @("$env:SystemRoot\System32\nvidia-smi.exe",
      "C:\Windows\System32\nvidia-smi.exe",
      "$env:ProgramFiles\NVIDIA Corporation\NVSMI\nvidia-smi.exe") | ForEach-Object {
        if (!$smiExe -and (Test-Path $_)) { $smiExe = $_ }
    }
}
if ($smiExe) {
    $raw = (& $smiExe --query-gpu=temperature.gpu --format=csv,noheader 2>$null).Trim()
    if ($raw -match '^\d+$') { $result.gpu_temp_c = [int]$raw }
    $raw = (& $smiExe --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null).Trim()
    if ($raw -match '^\d+$') { $result.gpu_load_pct = [int]$raw }
    $raw = (& $smiExe --query-gpu=name --format=csv,noheader 2>$null).Trim()
    if ($raw) { $result.gpu_name = $raw }
    $mu = (& $smiExe --query-gpu=memory.used  --format=csv,noheader,nounits 2>$null).Trim()
    $mt = (& $smiExe --query-gpu=memory.total --format=csv,noheader,nounits 2>$null).Trim()
    if ($mu -match '^\d+$' -and $mt -match '^\d+$') {
        $result.gpu_vram_used_mb  = [int]$mu
        $result.gpu_vram_total_mb = [int]$mt
    }
    $raw = (& $smiExe --query-gpu=fan.speed --format=csv,noheader,nounits 2>$null).Trim()
    if ($raw -match '^\d+$') { $result.gpu_fan_pct = [int]$raw }
} else {
    $result.gpu_name = "NVIDIA GPU (nvidia-smi.exe not found)"
}

# CPU Temperature (3 fallbacks)
$cpuTemp = $null
try {
    $zones = Get-WmiObject -Namespace "root\wmi" -Class MSAcpi_ThermalZoneTemperature -EA SilentlyContinue
    if ($zones) {
        $temps = $zones | ForEach-Object { [math]::Round($_.CurrentTemperature/10.0-273.15,1) } | Where-Object { $_ -gt 5 -and $_ -lt 120 }
        if ($temps) { $cpuTemp = ($temps | Measure-Object -Maximum).Maximum }
    }
} catch {}
if (-not $cpuTemp) {
    try {
        $s = (Get-Counter '\Thermal Zone Information(*)\High Precision Temperature' -SampleInterval 1 -MaxSamples 1 -EA SilentlyContinue).CounterSamples | Where-Object { $_.CookedValue -gt 2731 }
        if ($s) { $k=($s|Measure-Object -Property CookedValue -Maximum).Maximum; $c=[math]::Round($k/10.0-273.15,1); if($c-gt 5 -and $c-lt 120){$cpuTemp=$c} }
    } catch {}
}
if (-not $cpuTemp) {
    try {
        $ohm = Get-WmiObject -Namespace "root\OpenHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Temperature" -and $_.Name -match "CPU Package|CPU Core|Tdie|CPU CCD" }
        if ($ohm) { $v=($ohm|Measure-Object -Property Value -Maximum).Maximum; if($v-gt 5 -and $v-lt 120){$cpuTemp=[math]::Round($v,1)} }
    } catch {}
}
$result.cpu_temp_c = $cpuTemp
$result.cpu_temp_note = if ($cpuTemp) { "OK" } else { "AMD Ryzen desktop — use HWiNFO64 for accurate readings." }

# CPU Info & Load
try {
    $cpu = Get-CimInstance Win32_Processor -EA SilentlyContinue | Select-Object -First 1
    if ($cpu) { $result.cpu_name=$cpu.Name.Trim(); $result.cpu_cores=$cpu.NumberOfCores; $result.cpu_threads=$cpu.NumberOfLogicalProcessors; $result.cpu_mhz=$cpu.MaxClockSpeed }
} catch {}
try {
    $ld = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 1 -EA SilentlyContinue).CounterSamples[0].CookedValue
    if ($null -ne $ld) { $result.cpu_load_pct = [math]::Round($ld,1) }
} catch {}

# RAM
try {
    $os2 = Get-CimInstance Win32_OperatingSystem -EA SilentlyContinue
    if ($os2) {
        $result.ram_total_gb = [math]::Round($os2.TotalVisibleMemorySize/1MB,1)
        $result.ram_free_gb  = [math]::Round($os2.FreePhysicalMemory/1MB,1)
        $result.ram_used_pct = [math]::Round(100*(1-$os2.FreePhysicalMemory/$os2.TotalVisibleMemorySize),1)
    }
} catch {}

# Disks
try {
    $result.disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -EA SilentlyContinue | Select-Object -First 4 | ForEach-Object {
        [ordered]@{ drive=$_.DeviceID; free_gb=[math]::Round($_.FreeSpace/1GB,1); size_gb=[math]::Round($_.Size/1GB,1); used_pct=[math]::Round(100*(1-$_.FreeSpace/$_.Size),1) }
    })
} catch {}

# Fans
$fanList = [System.Collections.Generic.List[object]]::new()
if ($null -ne $result.gpu_fan_pct) { $fanList.Add([ordered]@{ name="GPU Fan"; speed_pct=$result.gpu_fan_pct; speed_rpm=$null }) }
$ohmDone = $false
try {
    $ohmF = Get-WmiObject -Namespace "root\OpenHardwareMonitor" -Class Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq "Fan" }
    if ($ohmF) { foreach($s in @($ohmF)){$fanList.Add([ordered]@{name=$s.Name;speed_pct=$null;speed_rpm=[math]::Round($s.Value)})}; $ohmDone=$true }
} catch {}
if (-not $ohmDone) {
    try {
        $wf=@(Get-WmiObject Win32_Fan -EA SilentlyContinue); $pf=@(Get-WmiObject Win32_PnPEntity -Filter "PNPClass='Fan'" -EA SilentlyContinue)
        $seen=[System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
        foreach($f in ($wf+$pf)){$n=if($f.Name){$f.Name}else{"Fan"}; if($seen.Add($n)){$rpm=if($f.PSObject.Properties['DesiredSpeed']-and $f.DesiredSpeed-gt 0){[int]$f.DesiredSpeed}else{$null}; $fanList.Add([ordered]@{name=$n;speed_pct=$null;speed_rpm=$rpm})}}
    } catch {}
}
if ($fanList.Count -gt 0) { $result.fans = $fanList.ToArray() }
$result.fan_count = $fanList.Count
$result.timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Desktop path — robust chain (works with OneDrive redirect, works non-elevated)
$desktop = $null
try {
    $rv = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' -EA SilentlyContinue).Desktop
    if ($rv) { $desktop = [Environment]::ExpandEnvironmentVariables($rv) }
} catch {}
if (-not $desktop -or -not (Test-Path $desktop -PathType Container)) {
    try { $desktop = [Environment]::GetFolderPath('Desktop') } catch {}
}
if (-not $desktop -or -not (Test-Path $desktop -PathType Container)) {
    $desktop = Join-Path $env:USERPROFILE 'Desktop'
}

# Collision-safe filename
$baseName = 'OptiGods-HW-Monitor'
$outPath  = Join-Path $desktop ($baseName + '.json')
$n = 2
while (Test-Path $outPath) { $outPath = Join-Path $desktop ($baseName + '_' + $n + '.json'); $n++ }

# Write JSON
$json = $result | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($outPath, $json, [Text.Encoding]::UTF8)
$fname = Split-Path $outPath -Leaf

# Results
Write-Host "  GPU       : $(if ($result.gpu_name) { $result.gpu_name } else { 'N/A' })" -ForegroundColor White
Write-Host "  GPU Temp  : $(if ($null -ne $result.gpu_temp_c) { [string]$result.gpu_temp_c + ' C' } else { 'N/A' })" -ForegroundColor Cyan
Write-Host "  GPU Fan   : $(if ($null -ne $result.gpu_fan_pct) { [string]$result.gpu_fan_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan
Write-Host "  CPU Temp  : $(if ($cpuTemp) { [string]$cpuTemp + ' C' } else { 'N/A  (AMD Ryzen desktop)' })" -ForegroundColor Cyan
Write-Host "  CPU Load  : $(if ($null -ne $result.cpu_load_pct) { [string]$result.cpu_load_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan
Write-Host "  RAM Used  : $(if ($null -ne $result.ram_used_pct) { [string]$result.ram_used_pct + '%' } else { 'N/A' })" -ForegroundColor Cyan
Write-Host "  Fans      : $(if ($result.fan_count -gt 0) { [string]$result.fan_count + ' detected' } else { 'N/A' })" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ================================================" -ForegroundColor DarkGray
Write-Host "  $fname has been placed on your Desktop." -ForegroundColor Green
Write-Host "  Drag it onto the Opti Gods System Scan tab to import." -ForegroundColor Yellow
Write-Host "  ================================================" -ForegroundColor DarkGray
Write-Host ""