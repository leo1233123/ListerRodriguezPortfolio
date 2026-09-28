param([int]$Port = 8000)

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Lister Rodriguez Portfolio - Local Preview Server" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Serving directory: $root" -ForegroundColor DarkGray
Write-Host "URL: http://localhost:$Port/" -ForegroundColor Green
Write-Host "Constellation Graph: http://localhost:$Port/#graph" -ForegroundColor Magenta
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host "===========================================================" -ForegroundColor Cyan

# Open default browser
Start-Process "http://localhost:$Port/"

# Built-in Windows .NET HttpListener (zero dependencies required)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
} catch {
    $Port = 8080
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$Port/")
    $listener.Start()
    Write-Host "Port 8000 occupied. Switched to: http://localhost:$Port/" -ForegroundColor Yellow
    Start-Process "http://localhost:$Port/"
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".webp" = "image/webp"
    ".pdf"  = "application/pdf"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath.TrimStart('/'))
        if ($urlPath -eq "" -or $urlPath -eq "/") { $urlPath = "index.html" }
        $filePath = Join-Path $root ($urlPath.Replace('/', '\'))

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
