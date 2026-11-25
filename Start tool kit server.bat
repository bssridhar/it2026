@echo off
rem Starts the tool kit server on this (main) computer. Keep the window open; close it to stop the server.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\kit-server.ps1" & exit /b
