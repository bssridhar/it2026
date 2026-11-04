@echo off
REM Opens the Statute Update Tracker in your web browser.
cd /d "%~dp0"
set PY=python
where py >nul 2>nul && set PY=py -3
%PY% app.py
pause
