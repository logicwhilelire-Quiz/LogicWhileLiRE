# LogicWhile LiRE - Pure PowerShell Supabase Seeder for Full Stack Development 2
param(
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

$headers = @{
    "apikey"        = $ServiceRoleKey
    "Authorization" = "Bearer $ServiceRoleKey"
    "Content-Type"  = "application/json"
    "Prefer"        = "resolution=merge-duplicates"
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "🚀 SEEDING FULL STACK DEVELOPMENT - 2 INTO SUPABASE (PURE POWERSHELL)" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan

# 1. College
$college = @{
    id                   = 80
    college_name         = "RV Institute of Technology (UGC – Autonomous)"
    college_code         = "RVIT"
    city                 = "Chebrolu, Guntur"
    state                = "Andhra Pradesh"
    contact_email        = "fsd2.rvit@logicwhilelire.com"
    contact_phone        = "+918106063555"
    is_active            = $true
    registration_enabled = $true
} | ConvertTo-Json

try {
    $resCol = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/colleges" -Method Post -Headers $headers -Body $college
    Write-Host "✓ College 80 (RVIT) verified." -ForegroundColor Green
} catch {
    Write-Host "Note: College update response: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. Exam Codes
$now = [DateTime]::UtcNow.ToString("o")
$future = [DateTime]::UtcNow.AddDays(365).ToString("o")

$examCodes = @(
    @{
        exam_code           = "FSD2026"
        exam_name           = "Full Stack Development – 2 Qualifier Assessment"
        subject             = "Full Stack Development"
        total_questions     = 36
        duration_minutes    = 45
        passing_percentage  = 40
        start_time          = $now
        end_time            = $future
        is_launched         = $true
        is_active           = $true
        results_published   = $true
        proctoring_enabled  = $true
        negative_marking    = 0
        total_marks         = 100
        max_participants    = 2500
        max_violations      = 5
        auto_terminate      = $true
        grace_period_seconds= 120
        allowed_languages   = @("javascript", "python", "cpp", "java")
        is_locked           = $false
        paper_status        = "allocated"
        college_id          = 80
        branch              = "CSE"
        passout_year        = 2026
    },
    @{
        exam_code           = "RVIT-FSD2-2026"
        exam_name           = "RVIT Full Stack Development – 2 Lab Examination"
        subject             = "Full Stack Development"
        total_questions     = 36
        duration_minutes    = 60
        passing_percentage  = 40
        start_time          = $now
        end_time            = $future
        is_launched         = $true
        is_active           = $true
        results_published   = $true
        proctoring_enabled  = $true
        negative_marking    = 0
        total_marks         = 100
        max_participants    = 2500
        max_violations      = 5
        auto_terminate      = $true
        grace_period_seconds= 120
        allowed_languages   = @("javascript", "python", "cpp", "java")
        is_locked           = $false
        paper_status        = "allocated"
        college_id          = 80
        branch              = "CSE"
        passout_year        = 2026
    }
)

foreach ($ec in $examCodes) {
    $ecJson = $ec | ConvertTo-Json
    try {
        $resEc = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/exam_codes" -Method Post -Headers $headers -Body $ecJson
        Write-Host "✓ Exam Code [$($ec.exam_code)] activated and launched." -ForegroundColor Green
    } catch {
        Write-Host "Note on exam code $($ec.exam_code): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# 3. Ensure test students exist
$students = @("2201A0501", "RVACJ31411", "24HU1A05F9")
foreach ($roll in $students) {
    $stu = @{
        name            = "R. Charan Sai Krishna"
        roll_number     = $roll
        hall_ticket     = $roll
        email           = "$($roll.ToLower())@logicwhilelire.com"
        college_id      = 80
        branch          = "CSE"
        branch_code     = "CSE"
        section         = "A"
        year_of_passing = 2026
        is_verified     = $true
        is_active       = $true
    } | ConvertTo-Json

    try {
        $resStu = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/students" -Method Post -Headers $headers -Body $stu
        Write-Host "✓ Student profile [$roll] verified and active." -ForegroundColor Green
    } catch {
        Write-Host "Note on student $($roll): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "🎉 ALL FULL STACK DEVELOPMENT EXAMS ARE LIVE IN SUPABASE!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
