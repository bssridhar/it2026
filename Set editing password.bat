@echo off
rem Sets (or removes) the password needed to change the notices, holidays and birthdays. Run it on the main computer.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\kit-server.ps1" -SetPassword & exit /b
