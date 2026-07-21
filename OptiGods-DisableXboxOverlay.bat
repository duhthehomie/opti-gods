@echo off
title Opti Gods - Disable Xbox Game Bar Overlay Popup
echo.
echo  Opti Gods - Disable Xbox ms-gamingoverlay popup
echo  ================================================
echo.

:: Disable Xbox Game Bar DVR
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR" /v "AllowGameDVR" /t REG_DWORD /d 0 /f >nul 2>&1
echo  [OK] Disabled GameDVR (user)

:: Disable via policy key
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\GameDVR" /v "AllowGameDVR" /t REG_DWORD /d 0 /f >nul 2>&1
echo  [OK] Disabled GameDVR (policy)

:: Disable Game Bar itself
reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR" /v "AppCaptureEnabled" /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\System\GameConfigStore" /v "GameDVR_Enabled" /t REG_DWORD /d 0 /f >nul 2>&1
echo  [OK] Disabled Game Bar capture

:: Remove ms-gamingoverlay protocol handler
reg delete "HKCR\ms-gamingoverlay" /f >nul 2>&1
echo  [OK] Removed ms-gamingoverlay protocol handler

echo.
echo  Done. The popup will no longer appear.
echo  (No restart needed)
echo.
pause
