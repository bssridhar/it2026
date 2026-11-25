@echo off
rem Run ONCE on the main computer: right-click this file and choose "Run as administrator".
rem It lets the other computers in the office reach the tool kit server (URL reservation and a Windows firewall rule).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\kit-server.ps1" -Setup & exit /b
