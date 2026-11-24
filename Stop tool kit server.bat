@echo off
rem Stops the tool kit server (also one started without a window).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\kit-server.ps1" -Stop & exit /b
