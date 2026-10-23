@echo off
REM ==============================================================================
REM LogicWhileLiRE — Daily Automated System Backup Windows Script
REM Triggered by Windows Task Scheduler
REM ==============================================================================

setlocal enabledelayedexpansion

REM Set working directory to the server directory
cd /d "%~dp0\.."

echo [%date% %time%] Starting automated LogicWhileLiRE database backup...

REM Run the backup CLI command
call npm run backup

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] SUCCESS: System backup completed successfully.
    exit /b 0
) else (
    echo [%date% %time%] ERROR: System backup failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)
