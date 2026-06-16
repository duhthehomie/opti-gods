$out = "$env:USERPROFILE\Desktop\FiveM-Scan-Results.txt"
"" | Out-File $out -Encoding UTF8

function W([string]$s) { $s | Add-Content $out -Encoding UTF8 }

W "FiveM Config Scanner by leaq"
W "Scanned: $(Get-Date)"
W ""

W "============================================"
W "FIVEM SHORTCUT ARGUMENTS"
W "============================================"
$wsh = New-Object -ComObject WScript.Shell
@(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\FiveM.lnk",
    "$env:PUBLIC\Desktop\FiveM.lnk",
    "$env:USERPROFILE\Desktop\FiveM.lnk"
) | Where-Object { Test-Path $_ } | ForEach-Object {
    $sc = $wsh.CreateShortcut($_)
    W "Shortcut : $_"
    W "  Target : $($sc.TargetPath)"
    W "  Args   : $($sc.Arguments)"
    W ""
}

W "============================================"
W "FIVEM APPDATA FOLDER LISTING"
W "============================================"
@(
    "$env:LOCALAPPDATA\FiveM\FiveM.app",
    "$env:LOCALAPPDATA\FiveM",
    "$env:APPDATA\CitizenFX"
) | ForEach-Object {
    if (Test-Path $_) {
        W "--- $_ ---"
        Get-ChildItem $_ -ErrorAction SilentlyContinue | ForEach-Object { W "  $($_.Name)" }
        W ""
    }
}

W "============================================"
W "CITIZENFX.INI CONTENTS"
W "============================================"
@(
    "$env:LOCALAPPDATA\FiveM\FiveM.app\CitizenFX.ini",
    "$env:LOCALAPPDATA\FiveM\CitizenFX.ini",
    "$env:APPDATA\CitizenFX\CitizenFX.ini"
) | Where-Object { Test-Path $_ } | ForEach-Object {
    W "--- $_ ---"
    Get-Content $_ | ForEach-Object { W $_ }
    W ""
}

W "============================================"
W "OTHER CONFIG FILES"
W "============================================"
$cfgDirs = @("$env:LOCALAPPDATA\FiveM\FiveM.app","$env:LOCALAPPDATA\FiveM","$env:APPDATA\CitizenFX")
$cfgNames = @("user.cfg","game.cfg","settings.xml","config.ini","client.cfg","app.manifest","version.txt","build.txt")
foreach ($d in $cfgDirs) {
    foreach ($n in $cfgNames) {
        $f = "$d\$n"
        if (Test-Path $f) {
            W "--- $f ---"
            Get-Content $f -ErrorAction SilentlyContinue | ForEach-Object { W $_ }
            W ""
        }
    }
}

W "============================================"
W "LATEST FIVEM LOG (last 80 lines)"
W "============================================"
$found = $false
@("$env:LOCALAPPDATA\FiveM\FiveM.app\logs","$env:LOCALAPPDATA\FiveM\logs","$env:APPDATA\CitizenFX\logs") | ForEach-Object {
    if (!$found -and (Test-Path $_)) {
        $latest = Get-ChildItem $_ -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) {
            W "--- $($latest.FullName) ---"
            Get-Content $latest.FullName -Tail 80 | ForEach-Object { W $_ }
            W ""
            $found = $true
        }
    }
}

W "============================================"
W "NVIDIA / GPU INFO"
W "============================================"
Get-WmiObject Win32_VideoController | ForEach-Object {
    W "  GPU        : $($_.Name)"
    W "  Driver     : $($_.DriverVersion)"
    W "  Refresh    : $($_.CurrentRefreshRate) Hz"
    W "  MaxRefresh : $($_.MaxRefreshRate) Hz"
    W ""
}

W "============================================"
W "HAGS STATUS"
W "============================================"
$hags = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" -Name HwSchMode -EA SilentlyContinue).HwSchMode
W "HwSchMode = $hags  (1=Off, 2=On)"
W ""

W "============================================"
W "NVIDIA OPENGL REGISTRY KEYS"
W "============================================"
0..3 | ForEach-Object {
    $k = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\{0:D4}" -f $_
    if (Test-Path $k) {
        $p = Get-ItemProperty $k -EA SilentlyContinue
        if ($p.DriverDesc -match "NVIDIA") {
            W "  Key $_ : $($p.DriverDesc)"
            W "    OpenGLCompatibilityMode   = $($p.OpenGLCompatibilityMode)"
            W "    OpenGLDefaultSwapInterval = $($p.OpenGLDefaultSwapInterval)"
            W ""
        }
    }
}

W "============================================"
W "SCAN COMPLETE"
W "============================================"

Write-Host ""
Write-Host "Saved to: $out" -ForegroundColor Green
Write-Host ""
Write-Host "Attach FiveM-Scan-Results.txt from your Desktop to the chat!" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
