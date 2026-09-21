@echo off
set "OUT=%USERPROFILE%\Desktop\FiveM-Scan-Results.txt"
echo FiveM Config Scanner by leaq > "%OUT%"
echo Scanned: %DATE% %TIME% >> "%OUT%"
echo. >> "%OUT%"

echo == FIVEM SHORTCUT ARGUMENTS == >> "%OUT%"
for %%P in (
    "%APPDATA%\Microsoft\Windows\Start Menu\Programs\FiveM.lnk"
    "%PUBLIC%\Desktop\FiveM.lnk"
    "%USERPROFILE%\Desktop\FiveM.lnk"
) do if exist %%P echo Found shortcut: %%~P >> "%OUT%"
echo (Open the shortcut Properties and paste the Target line here manually) >> "%OUT%"
echo. >> "%OUT%"

echo == FIVEM APPDATA FOLDERS == >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM"
    "%APPDATA%\CitizenFX"
) do (
    if exist %%D (
        echo --- %%~D --- >> "%OUT%"
        dir /b "%%~D" >> "%OUT%" 2>nul
        echo. >> "%OUT%"
    )
)

echo == CITIZENFX.INI == >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM"
    "%APPDATA%\CitizenFX"
) do (
    if exist "%%~D\CitizenFX.ini" (
        echo --- %%~D\CitizenFX.ini --- >> "%OUT%"
        type "%%~D\CitizenFX.ini" >> "%OUT%"
        echo. >> "%OUT%"
    )
)

echo == OTHER CONFIG FILES == >> "%OUT%"
for %%D in (
    "%LOCALAPPDATA%\FiveM\FiveM.app"
    "%LOCALAPPDATA%\FiveM"
    "%APPDATA%\CitizenFX"
) do (
    for %%F in (user.cfg game.cfg settings.xml config.ini client.cfg app.manifest version.txt) do (
        if exist "%%~D\%%F" (
            echo --- %%~D\%%F --- >> "%OUT%"
            type "%%~D\%%F" >> "%OUT%"
            echo. >> "%OUT%"
        )
    )
)

echo == HAGS STATUS == >> "%OUT%"
reg query "HKLM\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" /v HwSchMode >> "%OUT%" 2>&1
echo (1=Off 2=On) >> "%OUT%"
echo. >> "%OUT%"

echo == NVIDIA OPENGL KEYS == >> "%OUT%"
for /L %%i in (0,1,3) do (
    reg query "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i" /v DriverDesc >> "%OUT%" 2>nul
    reg query "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i" /v OpenGLCompatibilityMode >> "%OUT%" 2>nul
    reg query "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\000%%i" /v OpenGLDefaultSwapInterval >> "%OUT%" 2>nul
)
echo. >> "%OUT%"

echo == SCAN COMPLETE == >> "%OUT%"

echo.
echo Done! File saved to Desktop: FiveM-Scan-Results.txt
echo Attach that file to the chat.
echo.
pause
