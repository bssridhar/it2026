@echo off
REM Creates a Windows scheduled task that runs daily_check.bat every day at 9:15 AM.
REM Change the time below (24-hour clock) if you prefer another time.
set TIME_OF_DAY=09:15
if not exist "%~dp0data" mkdir "%~dp0data"
schtasks /Create /F /SC DAILY /ST %TIME_OF_DAY% /TN "Statute Update Tracker" /TR "\"%~dp0daily_check.bat\""
if errorlevel 1 (echo Could not create the scheduled task.) else (echo Done. The websites will be checked every day at %TIME_OF_DAY%.)
pause
