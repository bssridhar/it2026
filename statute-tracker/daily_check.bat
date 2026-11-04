@echo off
REM Checks all websites once and e-mails the report (if e-mail is set up in Settings).
REM Used by Windows Task Scheduler for the daily check.
cd /d "%~dp0"
if not exist data mkdir data
set PY=python
where py >nul 2>nul && set PY=py -3
%PY% tracker.py check --email > data\last_check_log.txt 2>&1
