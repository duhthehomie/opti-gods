@echo off
:: Auto-elevate — UAC pops up on double-click, no right-click needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -WindowStyle Hidden -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Run PowerShell minimized so it doesn't cover the stream
start "OptiGods" /min powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference='SilentlyContinue';" ^
"Write-Host '';" ^
"Write-Host '  OPTI GODS x leaq — COD Optimizer' -ForegroundColor Red;" ^
"Write-Host '  9800X3D + RTX 5070 + 32GB  |  Streamer Build' -ForegroundColor DarkGray;" ^
"Write-Host '  Running minimized — safe to use while live.' -ForegroundColor DarkGray;" ^
"Write-Host '';" ^
""^
"Write-Host '[1/8] Removing cod.exe High Priority IFEO (stream lag fix)...' -ForegroundColor Yellow;" ^
"$ifeo='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions';" ^
"If (Test-Path $ifeo) { Remove-Item -Path $ifeo -Force -Recurse; Write-Host '      [FIXED] IFEO override removed.' -ForegroundColor Green } Else { Write-Host '      [OK] Already clean.' -ForegroundColor DarkGray };" ^
""^
"Write-Host '[2/8] Alt-tab fix — foreground/background GPU priority...' -ForegroundColor Yellow;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl' -Name 'Win32PrioritySeparation' -Value 38 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile' -Name 'SystemResponsiveness' -Value 10 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'GPU Priority' -Value 8 -Type DWord -Force -EA SilentlyContinue;" ^
"Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Priority' -Value 6 -Type DWord -Force -EA SilentlyContinue;" ^
"Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games' -Name 'Scheduling Category' -Value 'High' -Type String -Force -EA SilentlyContinue;" ^
"Write-Host '      [OK] Win32PrioritySeparation=38, SystemResponsiveness=10 — smoother alt-tab.' -ForegroundColor Green;" ^
""^
"Write-Host '[3/8] Network socket buffers 512KB + LSO off + TCP no-delay...' -ForegroundColor Yellow;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultReceiveWindow' -Value 524288 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\AFD\Parameters' -Name 'DefaultSendWindow'   -Value 524288 -Type DWord -Force;" ^
"Get-NetAdapterAdvancedProperty -DisplayName '*Large Send Offload*' -EA SilentlyContinue | ForEach-Object { Disable-NetAdapterLso -Name $_.Name -EA SilentlyContinue };" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TCPNoDelay'      -Value 1 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'TcpAckFrequency' -Value 1 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name 'Tcp1323Opts'     -Value 0 -Type DWord -Force;" ^
"Write-Host '      [OK] Done.' -ForegroundColor Green;" ^
""^
"Write-Host '[4/8] AMD Ryzen 9800X3D — power plan + all cores unparked...' -ForegroundColor Yellow;" ^
"$r=powercfg -l | Select-String 'Ryzen'; If ($r) { $g=(($r.Line.Trim()) -split '\s+')[3]; powercfg -setactive $g 2>$null; Write-Host '      [OK] AMD Ryzen Balanced activated.' -ForegroundColor Green } Else { powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 be337238-0d82-4146-a960-4f3749d470c7 0; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 943c8cb6-6f93-4227-ad87-e9a3feec08d1 100; powercfg -setactive SCHEME_CURRENT; Write-Host '      [OK] CPU 0-100% applied.' -ForegroundColor Green };" ^
"$cp='HKLM:\SYSTEM\CurrentControlSet\Control\Power\PowerSettings\54533251-82be-4824-96c1-47b60b740d00\0cc5b647-c1df-4637-891a-dec35c318583'; If (Test-Path $cp) { Set-ItemProperty -Path $cp -Name 'ValueMax' -Value 0 -Type DWord -Force; Set-ItemProperty -Path $cp -Name 'Attributes' -Value 1 -Type DWord -Force }; powercfg -setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100 2>$null;" ^
"Write-Host '      [OK] All cores unparked.' -ForegroundColor Green;" ^
""^
"Write-Host '[5/8] NVIDIA RTX 5070 — Low Latency + Ansel off...' -ForegroundColor Yellow;" ^
"$nv='HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm'; If (Test-Path $nv) { Set-ItemProperty -Path $nv -Name 'NvCplLowLatencyMode' -Value 1 -Type DWord -Force; Write-Host '      [OK] Low Latency on.' -ForegroundColor Green };" ^
"$an='HKLM:\SOFTWARE\NVIDIA Corporation\Global\Ansel'; If (Test-Path $an) { Set-ItemProperty -Path $an -Name 'AnselEnable' -Value 0 -Type DWord -Force; Write-Host '      [OK] Ansel disabled.' -ForegroundColor Green };" ^
""^
"Write-Host '[6/8] Clearing shader + GPU driver cache...' -ForegroundColor Yellow;" ^
"@(""$env:LOCALAPPDATA\Activision\cod\cache"",""$env:LOCALAPPDATA\Battle.net\Cache"",""$env:LOCALAPPDATA\NVIDIA\DXCache"",""$env:LOCALAPPDATA\D3DSCache"") | ForEach-Object { If (Test-Path $_) { Remove-Item -Path ""$_\*"" -Recurse -Force -EA SilentlyContinue; Write-Host ""      Cleared: $_"" -ForegroundColor Cyan } };" ^
"Write-Host '      [OK] BO6 recompiles shaders on next launch (2-3 min once, then fixed).' -ForegroundColor Green;" ^
""^
"Write-Host '[7/8] Xbox DVR capture hooks off...' -ForegroundColor Yellow;" ^
"Set-ItemProperty -Path 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Type DWord -Force;" ^
"Set-ItemProperty -Path 'HKCU:\System\GameConfigStore' -Name 'GameDVR_HonorUserFSEBehaviorMode' -Value 1 -Type DWord -Force;" ^
"Write-Host '      [OK] Done.' -ForegroundColor Green;" ^
""^
"Write-Host '[8/8] OBS process priority bump...' -ForegroundColor Yellow;" ^
"$obs = Get-Process -Name 'obs64','obs' -EA SilentlyContinue | Select-Object -First 1;" ^
"If ($obs) { $obs.PriorityClass = 'AboveNormal'; Write-Host '      [OK] OBS set to AboveNormal — better encode while gaming.' -ForegroundColor Green } Else { Write-Host '      [SKIP] OBS not running. Open OBS > Settings > Advanced > Process Priority = Above Normal.' -ForegroundColor DarkYellow };" ^
""^
"Write-Host '';" ^
"Write-Host '  ============================================' -ForegroundColor Red;" ^
"Write-Host '  ALL DONE — restart COD. No reboot needed.' -ForegroundColor Red;" ^
"Write-Host '  ============================================' -ForegroundColor Red;" ^
"Write-Host '';" ^
"Write-Host '  ACTION REQUIRED for smooth alt-tab:' -ForegroundColor Yellow;" ^
"Write-Host '  In COD graphics settings, change Display Mode' -ForegroundColor White;" ^
"Write-Host '  from Exclusive Fullscreen to BORDERLESS WINDOWED.' -ForegroundColor White;" ^
"Write-Host '  This is the #1 fix for choppy tabs on a stream rig.' -ForegroundColor White;" ^
"Write-Host '';" ^
"Read-Host '  Press Enter to close'"
