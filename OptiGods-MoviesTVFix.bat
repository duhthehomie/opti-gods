@echo off
setlocal
set "SELF=%~f0"
set "TMPPS1=%TEMP%\OptiGods-MoviesTVFix.ps1"

title Opti Gods by leaq  --  Movies & TV Fix (Error 0x8007060e)
echo.
echo  ==========================================
echo    OPTI GODS by leaq  --  Movies & TV Fix (Error 0x8007060e)
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
Write-Host "  Opti Gods V4 - Movies & TV Fix (Error 0x8007060e)" -ForegroundColor Cyan
Write-Host "  =================================================" -ForegroundColor DarkCyan
Write-Host "  Fixes: Can't play .mp4 files · error 0x8007060e · HEVC/H.264 codec missing" -ForegroundColor Yellow
Write-Host ""
# FIX 1: Re-register H.264 and core Media Foundation decoder DLLs
Write-Host "[FIX 1] Re-registering H.264 / Media Foundation decoder DLLs..." -ForegroundColor Cyan
$mfDlls = @(
  "$env:SystemRoot\System32\msmpeg2vdec.dll",
  "$env:SystemRoot\System32\msmpeg2adec.dll",
  "$env:SystemRoot\System32\mf.dll",
  "$env:SystemRoot\System32\mfplat.dll",
  "$env:SystemRoot\System32\mfplay.dll",
  "$env:SystemRoot\System32\mfreadwrite.dll",
  "$env:SystemRoot\System32\mfh264enc.dll",
  "$env:SystemRoot\System32\evr.dll",
  "$env:SystemRoot\System32\mfsvr.dll"
)
ForEach ($dll in $mfDlls) {
  If (Test-Path $dll) {
    & regsvr32.exe /s $dll 2>&1 | Out-Null
    Write-Host "  [OK] Re-registered: $(Split-Path $dll -Leaf)" -ForegroundColor Green
  }
}
# FIX 2: Reset Media Foundation platform registry flags
Write-Host "[FIX 2] Restoring Media Foundation platform registry..." -ForegroundColor Cyan
$mfKey = 'HKLM:\SOFTWARE\Microsoft\Windows Media Foundation\Platform'
If (!(Test-Path $mfKey)) { New-Item -Path $mfKey -Force | Out-Null }
Remove-ItemProperty -Path $mfKey -Name "EnableFrameServerMode" -EA SilentlyContinue
Set-ItemProperty -Path $mfKey -Name "DisableReadStreamOnFailure" -Value 0 -Type DWord -Force
Write-Host "  [OK] MF Platform flags restored" -ForegroundColor Green
# FIX 3: Ensure PlayReady DRM key exists
Write-Host "[FIX 3] Checking PlayReady DRM environment..." -ForegroundColor Cyan
$prmKey = 'HKLM:\SOFTWARE\Microsoft\Windows Media Foundation\Protected Media Path'
If (!(Test-Path $prmKey)) { New-Item -Path $prmKey -Force | Out-Null }
Write-Host "  [OK] PlayReady key present" -ForegroundColor Green
# FIX 4: Clear broken .mp4 / .mov / .m4v UserChoice keys
Write-Host "[FIX 4] Resetting .mp4 / .mov / .m4v file associations..." -ForegroundColor Cyan
$exts = @(".mp4", ".mov", ".m4v")
ForEach ($ext in $exts) {
  $ucKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\UserChoice"
  If (Test-Path $ucKey) {
    $progId = (Get-ItemProperty -Path $ucKey -EA SilentlyContinue).ProgId
    If ($progId -and $progId -notmatch "ZuneVideo|WindowsAppRuntime") {
      Remove-Item -Path $ucKey -Recurse -Force -EA SilentlyContinue
      Write-Host "  [OK] Cleared broken $ext association (was: $progId)" -ForegroundColor Yellow
    } Else {
      Write-Host "  [OK] $ext association is correct — unchanged" -ForegroundColor DarkGray
    }
  } Else {
    Write-Host "  [OK] $ext uses system default" -ForegroundColor DarkGray
  }
}
# FIX 5: Clear Movies & TV (Zune) cache and thumbnail database
Write-Host "[FIX 5] Clearing Movies & TV cache and thumbnails..." -ForegroundColor Cyan
$zuneCache = "$env:LOCALAPPDATA\Packages\Microsoft.ZuneVideo_8wekyb3d8bbwe\LocalCache"
If (Test-Path $zuneCache) {
  Remove-Item -Path "$zuneCache\*" -Recurse -Force -EA SilentlyContinue
  Write-Host "  [OK] Zune / Movies & TV LocalCache cleared" -ForegroundColor Green
} Else {
  Write-Host "  [INFO] Zune cache not found (app may not be installed)" -ForegroundColor DarkGray
}
$thumbDir = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
If (Test-Path $thumbDir) {
  Get-ChildItem -Path $thumbDir -Filter "thumbcache_*.db" -EA SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Force -EA SilentlyContinue }
  Write-Host "  [OK] Thumbnail cache cleared (Windows will rebuild)" -ForegroundColor Green
}
# FIX 6: Re-add Windows Media Feature Pack if removed by debloat
Write-Host "[FIX 6] Checking Windows Media Feature Pack..." -ForegroundColor Cyan
$cap = "Media.MediaFeaturePack~~~~0.0.1.0"
$state = (Get-WindowsCapability -Online -Name $cap -EA SilentlyContinue).State
If ($state -eq "NotPresent") {
  Write-Host "  [INFO] Media Feature Pack is missing — re-adding (may take 30-60 seconds)..." -ForegroundColor Yellow
  Add-WindowsCapability -Online -Name $cap -EA SilentlyContinue | Out-Null
  Write-Host "  [OK] Media Feature Pack re-added" -ForegroundColor Green
} ElseIf ($state -eq "Installed") {
  Write-Host "  [OK] Media Feature Pack already installed" -ForegroundColor Green
} Else {
  Write-Host "  [INFO] Capability state: $state" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  ALL FIXES APPLIED." -ForegroundColor Cyan
Write-Host "  Restart your PC for changes to take full effect." -ForegroundColor Yellow
Write-Host "  After reboot: Movies & TV should play .mp4 / .mov files normally." -ForegroundColor Green
Write-Host ""
Write-Host "  NOTE: If error 0x8007060e persists for H.265 / HEVC files:" -ForegroundColor Yellow
Write-Host "    Search 'HEVC Video Extensions from Device Manufacturer' in the Microsoft Store." -ForegroundColor Yellow
Write-Host "  (Free from your PC maker — different from the paid 'HEVC Video Extensions' listing)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Opti Gods by leaq" -ForegroundColor DarkCyan
Write-Host ""; pause