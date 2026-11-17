@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Anioto.ps1" %*
if errorlevel 1 (
    echo Anioto setup could not finish. Review the message above.
    pause
    exit /b 1
)
echo Anioto setup finished.
pause
