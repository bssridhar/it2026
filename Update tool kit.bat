@echo off
rem Update the Practice tool kit: double-click and choose the new zip, or drop the zip on this file.
rem (Everything is on one line so that this file can be replaced by the update while it runs.)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater\update-kit.ps1" %1 & exit /b
