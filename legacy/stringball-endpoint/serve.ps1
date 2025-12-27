Param(
    [int]$Port = 8080,
    [string]$Root = (Get-Location).Path
)

Write-Host "Starting simple PowerShell static server on http://localhost:$Port/ serving $Root"

Add-Type -AssemblyName System.Web
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Listening on $prefix"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
        if ([string]::IsNullOrEmpty($urlPath)) { $urlPath = 'index.html' }
        $filePath = Join-Path $Root $urlPath
        if (Test-Path $filePath -PathType Leaf) {
            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                $mime = [System.Web.MimeMapping]::GetMimeMapping($filePath)
                $response.ContentType = $mime
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
                $response.StatusDescription = "Server Error"
                $msg = [System.Text.Encoding]::UTF8.GetBytes("500 - Server Error")
                $response.OutputStream.Write($msg,0,$msg.Length)
            }
        } else {
            $response.StatusCode = 404
            $response.StatusDescription = "Not Found"
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - Not Found")
            $response.OutputStream.Write($msg,0,$msg.Length)
        }
        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
