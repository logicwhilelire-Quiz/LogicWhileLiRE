param(
    [int]$Port = 5173,
    [string]$DistPath = "$PSScriptRoot\client\dist",
    [string]$RemoteApiUrl = "https://logicwhilelire-api.onrender.com"
)

# Enable TLS 1.2 and 1.3
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host "════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 LOGICWHILE LIRE LIVE PORTAL & PROXY GATEWAY" -ForegroundColor Green
Write-Host "🌐 Local Access:   http://localhost:$Port" -ForegroundColor Yellow
Write-Host "🔌 Remote Backend: $RemoteApiUrl" -ForegroundColor Blue
Write-Host "🗄️ Database:       Supabase PostgreSQL" -ForegroundColor Blue
Write-Host "🛡️ CORS Proxy:     Enabled for /api/* -> Render Backend" -ForegroundColor Magenta
Write-Host "════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

$mimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".mjs"   = "application/javascript; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".json"  = "application/json"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
    ".webp"  = "image/webp"
    ".pdf"   = "application/pdf"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.RawUrl
        $pathOnly = $rawUrl.Split('?')[0]

        # ── 1. PROXY API REQUESTS TO RENDER BACKEND ──────────────────────────────
        if ($pathOnly.StartsWith("/api/")) {
            $targetUrl = "$RemoteApiUrl$rawUrl"
            try {
                if ($request.HttpMethod -eq "OPTIONS") {
                    $response.StatusCode = 200
                    $origin = if ($request.Headers["Origin"]) { $request.Headers["Origin"] } else { "*" }
                    $response.Headers.Add("Access-Control-Allow-Origin", $origin)
                    $response.Headers.Add("Access-Control-Allow-Credentials", "true")
                    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
                    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, x-xsrf-token, x-request-id")
                    $response.OutputStream.Close()
                    continue
                }

                $proxyReq = [System.Net.HttpWebRequest]::Create($targetUrl)
                $proxyReq.Method = $request.HttpMethod
                $proxyReq.Timeout = 65000
                $proxyReq.ReadWriteTimeout = 65000
                $proxyReq.AutomaticDecompression = [System.Net.DecompressionMethods]::None

                if ($request.ContentType) {
                    $proxyReq.ContentType = $request.ContentType
                }
                if ($request.UserAgent) {
                    $proxyReq.UserAgent = $request.UserAgent
                }

                # Forward custom headers
                foreach ($hKey in $request.Headers.AllKeys) {
                    if ($hKey -notin @("Host", "Connection", "Content-Length", "Accept-Encoding", "User-Agent", "Content-Type")) {
                        try {
                            $proxyReq.Headers.Set($hKey, $request.Headers[$hKey])
                        } catch {}
                    }
                }

                # Forward request body for POST/PUT/PATCH
                if ($request.HasEntityBody) {
                    $reqStream = $request.InputStream
                    $proxyStream = $proxyReq.GetRequestStream()
                    $reqStream.CopyTo($proxyStream)
                    $proxyStream.Close()
                }

                $proxyRes = $proxyReq.GetResponse()
                $resStream = $proxyRes.GetResponseStream()

                $response.StatusCode = [int]$proxyRes.StatusCode
                if ($proxyRes.ContentType) {
                    $response.ContentType = $proxyRes.ContentType
                }

                $origin = if ($request.Headers["Origin"]) { $request.Headers["Origin"] } else { "*" }
                $response.Headers.Add("Access-Control-Allow-Origin", $origin)
                $response.Headers.Add("Access-Control-Allow-Credentials", "true")
                $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
                $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, x-xsrf-token, x-request-id")

                $resStream.CopyTo($response.OutputStream)
                $resStream.Close()
                $proxyRes.Close()
            } catch {
                $inner = $_.Exception
                while ($inner.InnerException) { $inner = $inner.InnerException }
                if ($inner -is [System.Net.WebException] -and $inner.Response) {
                    $errRes = [System.Net.HttpWebResponse]$inner.Response
                    $response.StatusCode = [int]$errRes.StatusCode
                    if ($errRes.ContentType) {
                        $response.ContentType = $errRes.ContentType
                    }
                    $origin = if ($request.Headers["Origin"]) { $request.Headers["Origin"] } else { "*" }
                    $response.Headers.Add("Access-Control-Allow-Origin", $origin)
                    $response.Headers.Add("Access-Control-Allow-Credentials", "true")
                    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
                    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, x-xsrf-token, x-request-id")
                    $errStream = $errRes.GetResponseStream()
                    $errStream.CopyTo($response.OutputStream)
                    $errStream.Close()
                    $errRes.Close()
                } else {
                    $response.StatusCode = 504
                    $errMsg = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Backend gateway timeout or cold start in progress"}')
                    $response.ContentType = "application/json"
                    $response.OutputStream.Write($errMsg, 0, $errMsg.Length)
                }
            } finally {
                try { $response.OutputStream.Close() } catch {}
            }
            continue
        }

        # ── 2. STATIC ASSETS & SPA CLIENT ROUTING ────────────────────────────────
        $relPath = $pathOnly.TrimStart('/')
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
            try { $response.OutputStream.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
}
