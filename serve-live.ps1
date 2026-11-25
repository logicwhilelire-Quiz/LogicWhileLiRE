param(
    [int]$Port = 5173,
    [string]$DistPath = "$PSScriptRoot\client\dist"
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "Port $Port is already registered or busy. Retrying on port 5174..." -ForegroundColor Yellow
    $Port = 5174
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Start()
}

Write-Host "════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 LOGICWHILE LIRE PORTAL IS LIVE!" -ForegroundColor Green
Write-Host "🌐 Local Access:   http://localhost:$Port" -ForegroundColor Yellow
Write-Host "🔌 Remote Backend: https://logicwhilelire-api.onrender.com" -ForegroundColor Blue
Write-Host "🗄️ Database:       Supabase PostgreSQL" -ForegroundColor Blue
Write-Host "════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".webp" = "image/webp"
    ".pdf"  = "application/pdf"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.RawUrl.Split('?')[0]
        $relPath = $rawUrl.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) { $relPath = "index.html" }

        $filePath = Join-Path $DistPath $relPath.Replace('/', '\')

        # SPA Routing: if file does not exist, serve index.html for client routes
        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path $DistPath "index.html"
        }

        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

        try {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $response.StatusCode = 500
        } finally {
            $response.OutputStream.Close()
        }
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
