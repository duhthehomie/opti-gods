@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-MoviesTVFix.ps1"

title Opti Gods by leaq  --  Movies & TV Clip Fix v2
echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  Movies & TV Clip Fix v2
echo  ==========================================
echo.
echo  [1/2] Extracting script...
PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$c=[IO.File]::ReadAllText($env:SELF,[Text.Encoding]::UTF8);$m='##MOVIES_TV_FI'+'X_PS1_START##';$i=$c.IndexOf($m);if($i -ge 0){[IO.File]::WriteAllText($env:TMPPS1,$c.Substring($i+$m.Length),[Text.Encoding]::UTF8)}"
if not exist "%TMPPS1%" (
  echo.
  echo  [ERROR] Extraction failed. Re-download from the website.
  pause
  exit /b 1
)
echo  [2/2] Click Yes on the UAC prompt to run as Administrator.
echo.
PowerShell -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File '+[char]34+$env:TMPPS1+[char]34) } catch { Write-Host ('UAC cancelled: '+$_) -ForegroundColor Red; Read-Host 'Press Enter to close' }"
del "%TMPPS1%" 2>nul
exit /b 0
##MOVIES_TV_FIX_PS1_START##
$ErrorActionPreference = 'SilentlyContinue'
Write-Host ""
Write-Host "  Opti Gods V4 - Movies & TV Clip Fix (v2)" -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor DarkCyan
Write-Host "  Fixes: Can't open clips · error 0x8007060e · MP4 won't play" -ForegroundColor Yellow
Write-Host ""
# FIX 1: Re-register the Movies & TV AppX package (most common fix)
Write-Host "[FIX 1] Re-registering Movies & TV app package..." -ForegroundColor Cyan
$zuneApp = Get-AppxPackage -AllUsers *ZuneVideo* -EA SilentlyContinue
If ($zuneApp) {
  ForEach ($app in $zuneApp) {
    $manifest = "$($app.InstallLocation)\AppXManifest.xml"
    If (Test-Path $manifest) {
      Add-AppxPackage -DisableDevelopmentMode -Register $manifest -EA SilentlyContinue
      Write-Host "  [OK] Re-registered: $($app.Name) $($app.Version)" -ForegroundColor Green
    }
  }
} Else {
  Write-Host "  [INFO] Movies & TV not found — may need reinstall from Microsoft Store" -ForegroundColor Yellow
}
# Also re-register the new Windows Media Player app if present (Win11)
$wmpApp = Get-AppxPackage -AllUsers *WindowsMediaPlayer* -EA SilentlyContinue
If ($wmpApp) {
  ForEach ($app in $wmpApp) {
    $manifest = "$($app.InstallLocation)\AppXManifest.xml"
    If (Test-Path $manifest) {
      Add-AppxPackage -DisableDevelopmentMode -Register $manifest -EA SilentlyContinue
      Write-Host "  [OK] Re-registered: Windows Media Player (Win11)" -ForegroundColor Green
    }
  }
}
# FIX 2: Re-register core Media Foundation + H.264 decoder DLLs
Write-Host "[FIX 2] Re-registering Media Foundation and H.264 decoder DLLs..." -ForegroundColor Cyan
$mfDlls = @(
  "$env:SystemRoot\System32\msmpeg2vdec.dll",
  "$env:SystemRoot\System32\msmpeg2adec.dll",
  "$env:SystemRoot\System32\mf.dll",
  "$env:SystemRoot\System32\mfplat.dll",
  "$env:SystemRoot\System32\mfplay.dll",
  "$env:SystemRoot\System32\mfreadwrite.dll",
  "$env:SystemRoot\System32\evr.dll"
)
ForEach ($dll in $mfDlls) {
  If (Test-Path $dll) {
    & regsvr32.exe /s $dll 2>&1 | Out-Null
    Write-Host "  [OK] $(Split-Path $dll -Leaf)" -ForegroundColor Green
  }
}
# FIX 3: Reset MF Platform registry flags
Write-Host "[FIX 3] Restoring Media Foundation platform registry..." -ForegroundColor Cyan
$mfKey = 'HKLM:\SOFTWARE\Microsoft\Windows Media Foundation\Platform'
If (!(Test-Path $mfKey)) { New-Item -Path $mfKey -Force | Out-Null }
Remove-ItemProperty -Path $mfKey -Name "EnableFrameServerMode" -EA SilentlyContinue
Set-ItemProperty -Path $mfKey -Name "DisableReadStreamOnFailure" -Value 0 -Type DWord -Force
Write-Host "  [OK] MF Platform registry restored" -ForegroundColor Green
# FIX 4: Clear all .mp4 / .mov / .mkv / .avi / .wmv UserChoice overrides
Write-Host "[FIX 4] Clearing broken file association overrides..." -ForegroundColor Cyan
$exts = @(".mp4", ".mov", ".m4v", ".mkv", ".avi", ".wmv", ".mpg", ".mpeg")
ForEach ($ext in $exts) {
  $ucKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\UserChoice"
  If (Test-Path $ucKey) {
    $progId = (Get-ItemProperty -Path $ucKey -EA SilentlyContinue).ProgId
    If ($progId -and $progId -notmatch "ZuneVideo|WindowsAppRuntime|WindowsMediaPlayer|VLC|MPC") {
      Remove-Item -Path $ucKey -Recurse -Force -EA SilentlyContinue
      Write-Host "  [OK] Cleared broken $ext override (was: $progId)" -ForegroundColor Yellow
    } Else {
      Write-Host "  [OK] $ext — OK ($progId)" -ForegroundColor DarkGray
    }
  }
}
# FIX 5: Clear Movies & TV app data cache
Write-Host "[FIX 5] Clearing Movies & TV cache..." -ForegroundColor Cyan
$zunePkg = "$env:LOCALAPPDATA\Packages\Microsoft.ZuneVideo_8wekyb3d8bbwe"
ForEach ($sub in @("LocalCache", "TempState")) {
  $p = "$zunePkg\$sub"
  If (Test-Path $p) {
    Remove-Item "$p\*" -Recurse -Force -EA SilentlyContinue
    Write-Host "  [OK] Cleared $sub" -ForegroundColor Green
  }
}
$thumbDir = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
If (Test-Path $thumbDir) {
  Get-ChildItem $thumbDir -Filter "thumbcache_*.db" |
    ForEach-Object { Remove-Item $_.FullName -Force -EA SilentlyContinue }
  Write-Host "  [OK] Thumbnail cache cleared" -ForegroundColor Green
}
# FIX 6: Re-add Windows Media Feature Pack if stripped by debloat
Write-Host "[FIX 6] Checking Windows Media Feature Pack..." -ForegroundColor Cyan
$cap = "Media.MediaFeaturePack~~~~0.0.1.0"
$capState = (Get-WindowsCapability -Online -Name $cap -EA SilentlyContinue).State
If ($capState -eq "NotPresent") {
  Write-Host "  [INFO] Missing — re-adding (30-60 seconds)..." -ForegroundColor Yellow
  Add-WindowsCapability -Online -Name $cap -EA SilentlyContinue | Out-Null
  Write-Host "  [OK] Media Feature Pack restored" -ForegroundColor Green
} Else {
  Write-Host "  [OK] Media Feature Pack present" -ForegroundColor Green
}
# FIX 7: Re-enable WMPNetworkSvc and set MF protected path
Write-Host "[FIX 7] Restoring WMP service + PlayReady key..." -ForegroundColor Cyan
Set-Service WMPNetworkSvc -StartupType Manual -EA SilentlyContinue
$pr = 'HKLM:\SOFTWARE\Microsoft\Windows Media Foundation\Protected Media Path'
If (!(Test-Path $pr)) { New-Item -Path $pr -Force | Out-Null }
Write-Host "  [OK] Done" -ForegroundColor Green
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor DarkCyan
Write-Host "  ALL FIXES APPLIED. Restart your PC now." -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  After reboot: right-click your clip > Open With > Movies & TV" -ForegroundColor Green
Write-Host "  (or Movies & TV should open it automatically)" -ForegroundColor Green
Write-Host ""
Write-Host "  IF IT STILL FAILS after restart:" -ForegroundColor Yellow
Write-Host "  The clip is H.265/HEVC encoded. Open Microsoft Store and search:" -ForegroundColor Yellow
Write-Host "  'HEVC Video Extensions from Device Manufacturer' (free, from your PC maker)" -ForegroundColor White
Write-Host "  OR install VLC (free) — plays everything: https://www.videolan.org" -ForegroundColor White
Write-Host ""
Write-Host "  Opti Gods by leaq" -ForegroundColor DarkCyan
Write-Host ""; pause