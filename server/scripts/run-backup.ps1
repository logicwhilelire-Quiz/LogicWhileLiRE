<#
.SYNOPSIS
    Automated Daily System Backup for LogicWhileLiRE Assessment Platform
    Designed for execution via Windows Task Scheduler or manual administrator trigger.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ServerDir = Resolve-Path "$ScriptDir\.."

Set-Location -Path $ServerDir

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "💾 LogicWhileLiRE — Daily System Backup Task" -ForegroundColor White
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Server Working Dir: $ServerDir" -ForegroundColor Gray
Write-Host "==========================================================================" -ForegroundColor Cyan

npm run backup

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Backup completed and verified with row-count integrity." -ForegroundColor Green
    Exit 0
} else {
    Write-Host "`n❌ Backup failed with exit code $LASTEXITCODE." -ForegroundColor Red
    Exit $LASTEXITCODE
}
