@echo off
setlocal enabledelayedexpansion
set "OUT=%USERPROFILE%\Desktop\FiveM-Scan-Results.txt"
echo FiveM Config Scanner by leaq > "%OUT%"
echo Scanned: %DATE% %TIME% >> "%OUT%"
echo. >> "%OUT%"

echo ============================================ >> "%OUT%"
echo FIVEM SHORTCUT ARGUMENTS >> "%OUT%"
echo ============================================ >> "%OUT%"
powershell -NoProfile -Command "$wsh=New-Object -ComObject WScript.Shell; @('%APPDATA%\Microsoft\Windows\Start Menu\Programs\FiveM.lnk','%PUBLIC%\Desktop\FiveM.lnk','%USERPROFILE%\Desktop\FiveM.lnk') | foreach { if(Test-Path $_){ $sc=$wsh.CreateShortcut($_); \"[$_] Target: \" + $sc.TargetPath + \" | Args: \" + $sc.Arguments } }" >> "%OUT%" 2>&1
echo. >> "%OUT%"

echo ============================================ >> "%OUT%"
echo FIVEM APP DATA FILES >> "%OUT%"
echo ============================================ >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM"
    "%APPDATA%\CitizenFX"
) do (
    if exist "%%~D" (
        echo --- Folder: %%~D --- >> "%OUT%"
        dir /b /a "%%~D" >> "%OUT%" 2>nul
        echo. >> "%OUT%"
    )
)

echo ============================================ >> "%OUT%"
echo CITIZENFX.INI CONTENTS >> "%OUT%"
echo ============================================ >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app\CitizenFX.ini"
    "%LOCALAPPDATA%\FiveM\CitizenFX.ini"
    "%APPDATA%\CitizenFX\CitizenFX.ini"
) do (
    if exist "%%~D" (
        echo --- %%~D --- >> "%OUT%"
        type "%%~D" >> "%OUT%"
        echo. >> "%OUT%"
    )
)

echo ============================================ >> "%OUT%"
echo USER.CFG / GAME.CFG / SETTINGS.XML >> "%OUT%"
echo ============================================ >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM\FiveM.app\data"
    "%LOCALAPPDATA%\FiveM"
    "%APPDATA%\CitizenFX"
) do (
    for %%F in (user.cfg game.cfg settings.xml config.ini client.cfg) do (
        if exist "%%~D\%%F" (
            echo --- %%~D\%%F --- >> "%OUT%"
            type "%%~D\%%F" >> "%OUT%"
            echo. >> "%OUT%"
        )
    )
)

echo ============================================ >> "%OUT%"
echo FIVEM VERSION (APPLICATION MANIFEST) >> "%OUT%"
echo ============================================ >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM"
) do (
    for %%F in (app.manifest version.txt build.txt) do (
        if exist "%%~D\%%F" (
            echo --- %%~D\%%F --- >> "%OUT%"
            type "%%~D\%%F" >> "%OUT%"
            echo. >> "%OUT%"
        )
    )
)

echo ============================================ >> "%OUT%"
echo LATEST FIVEM LOG (last 100 lines) >> "%OUT%"
echo ============================================ >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app\logs"
    "%LOCALAPPDATA%\FiveM\logs"
    "%APPDATA%\CitizenFX\logs"
) do (
    if exist "%%~D" (
        echo --- Log folder: %%~D --- >> "%OUT%"
        for /f "delims=" %%L in ('dir /b /o-d "%%~D\*.log" 2^>nul') do (
            echo Latest log: %%L >> "%OUT%"
            powershell -NoProfile -Command "Get-Content '%%~D\%%L' -Tail 100" >> "%OUT%" 2>nul
            goto :donelog
        )
        :donelog
        echo. >> "%OUT%"
    )
)

echo ============================================ >> "%OUT%"
echo NVIDIA DRIVER + MONITOR INFO >> "%OUT%"
echo ============================================ >> "%OUT%"
powershell -NoProfile -Command "Get-WmiObject Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate,MaxRefreshRate | Format-List" >> "%OUT%" 2>&1
echo. >> "%OUT%"

echo ============================================ >> "%OUT%"
echo HAGS STATUS >> "%OUT%"
echo ============================================ >> "%OUT%"
reg query "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v HwSchMode >> "%OUT%" 2>&1
echo (1=Off, 2=On) >> "%OUT%"
echo. >> "%OUT%"

echo ============================================ >> "%OUT%"
echo NVIDIA OPENGL REGISTRY KEYS >> "%OUT%"
echo ============================================ >> "%OUT%"
for /L %%i in (0,1,3) do (
    reg query "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i" /v OpenGLCompatibilityMode >> "%OUT%" 2>nul
    reg query "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i" /v OpenGLDefaultSwapInterval >> "%OUT%" 2>nul
)
echo. >> "%OUT%"

echo Done! Results saved to:
echo %OUT%
echo.
echo Share that file with leaq to diagnose the cap.
echo.
pause
