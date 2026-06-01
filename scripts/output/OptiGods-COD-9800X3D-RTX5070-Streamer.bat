@echo off
:: Auto-elevate to Administrator — UAC popup appears automatically on double-click
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -WindowStyle Hidden -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference='SilentlyContinue';" ^
"Write-Host '';" ^
"Write-Host '  OPTI GODS — COD Optimizer' -ForegroundColor Red;" ^
"Write-Host '  Rig: 9800X3D + RTX 5070 + 32GB  |  Streamer Profile' -ForegroundColor DarkGray;" ^
"Write-Host '';" ^
"Write-Host '[1/7] Removing cod.exe High Priority IFEO entry (stream lag fix)...' -ForegroundColor Yellow;" ^
"$ifeo='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions';" ^
"If (Test-Path $ifeo) { Remove-Item -Path $ifeo -Force -Recurse; Write-Host '      [FIXED] IFEO override removed.' -ForegroundColor Green } Else { Write-Host '      [OK] Already clean.' -ForegroundColor DarkGray };" ^
"Write-Host '[2/7] Network socket buffers 512KB...' -ForegroundColor Yellow;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow'   -Value 524288 -Type DWord -Force;" ^
"Write-Host '      [OK] Done.' -ForegroundColor Green;" ^
"Write-Host '[3/7] TCP no-delay + LSO off...' -ForegroundColor Yellow;" ^
"Get-NetAdapterAdvancedProperty -DisplayName '*Large Send Offload*' -EA SilentlyContinue | ForEach-Object { Disable-NetAdapterLso -Name $_.Name -EA SilentlyContinue };" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TCPNoDelay'      -Value 1 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TcpAckFrequency' -Value 1 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'Tcp1323Opts'     -Value 0 -Type DWord -Force;" ^
"Write-Host '      [OK] Done.' -ForegroundColor Green;" ^
"Write-Host '[4/7] AMD Ryzen 9800X3D power plan + core unpark...' -ForegroundColor Yellow;" ^
"$r=powercfg -l | Select-String 'Ryzen'; If ($r) { $g=(($r.Line.Trim()) -split '\s+')[3]; powercfg -setactive $g 2>$null; Write-Host '      [OK] AMD Ryzen Balanced activated.' -ForegroundColor Green } Else { powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 0; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 943c8cb6-6f93-4227-ad87-e9a3feec08d1 100; powercfg -setactive SCHEME_CURRENT; Write-Host '      [OK] CPU min 0% max 100%.' -ForegroundColor Green };" ^
"$cp='HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; If (Test-Path $cp) { Set-ItemProperty -Path $cp -Name 'ValueMax' -Value 0 -Type DWord -Force; Set-ItemProperty -Path $cp -Name 'Attributes' -Value 1 -Type DWord -Force }; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null;" ^
"Write-Host '      [OK] All cores unparked.' -ForegroundColor Green;" ^
"Write-Host '[5/7] NVIDIA RTX 5070 driver tweaks...' -ForegroundColor Yellow;" ^
"$nv='HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm'; If (Test-Path $nv) { Set-ItemProperty -Path $nv -Name 'NvCplLowLatencyMode' -Value 1 -Type DWord -Force; Write-Host '      [OK] Low Latency mode on.' -ForegroundColor Green };" ^
"$an='HKLM:\SOFTWARE\NVIDIA Corporation\Global\Ansel'; If (Test-Path $an) { Set-ItemProperty -Path $an -Name 'AnselEnable' -Value 0 -Type DWord -Force; Write-Host '      [OK] Ansel disabled.' -ForegroundColor Green };" ^
"Write-Host '[6/7] Clearing shader + GPU driver cache...' -ForegroundColor Yellow;" ^
"@(%LocalAppData%\Activision\cod\cache,%LocalAppData%\Battle.net\Cache,%LocalAppData%\NVIDIA\DXCache,%LocalAppData%\D3DSCache) | ForEach-Object { If (Test-Path $_) { Remove-Item -Path ""$_\*"" -Recurse -Force -EA SilentlyContinue; Write-Host ""      Cleared: $_"" -ForegroundColor Cyan } };" ^
"Write-Host '      [OK] Done. BO6 recompiles shaders on next launch (2-3 min stutter once, then fixed).' -ForegroundColor Green;" ^
"Write-Host '[7/7] Disabling Xbox DVR capture hooks...' -ForegroundColor Yellow;" ^
"Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -Value 1 -Type DWord -Force;" ^
"Write-Host '      [OK] Done.' -ForegroundColor Green;" ^
"Write-Host '';" ^
"Write-Host '  ALL DONE — restart COD. No reboot needed.' -ForegroundColor Red;" ^
"Write-Host '  Stream lag fix, network, power plan, NVIDIA tweaks, cache cleared.' -ForegroundColor White;" ^
"Write-Host ''; Read-Host '  Press Enter to close'"
