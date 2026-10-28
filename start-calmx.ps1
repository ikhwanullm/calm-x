# Calm-X launcher: rebuilds the frontend when needed, starts the server
# and opens the app in the browser. Close the window (or Ctrl+C) to stop.
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:$Port"
Set-Location $root
$host.UI.RawUI.WindowTitle = "Calm-X ($url)"

# Rebuild only when the build is missing or a source file changed after it.
$index = Join-Path $root 'frontend\dist\index.html'
$needsBuild = -not (Test-Path $index)
if (-not $needsBuild) {
    $builtAt = (Get-Item $index).LastWriteTime
    $changed = Get-ChildItem (Join-Path $root 'frontend\src') -Recurse -File |
        Where-Object { $_.LastWriteTime -gt $builtAt } |
        Select-Object -First 1
    $needsBuild = $null -ne $changed
}

if ($needsBuild) {
    Write-Host 'Building the frontend...'
    Push-Location (Join-Path $root 'frontend')
    npm run build
    $buildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $buildOk) {
        Write-Host 'Build failed. See the messages above.' -ForegroundColor Red
        Read-Host 'Press Enter to close'
        exit 1
    }
}

# Open the browser as soon as the server answers (up to 15 seconds).
if (-not $NoBrowser) {
    Start-Job -ArgumentList $url -ScriptBlock {
        param($u)
        for ($i = 0; $i -lt 30; $i++) {
            try {
                Invoke-WebRequest "$u/api/settings" -UseBasicParsing -TimeoutSec 1 | Out-Null
                Start-Process $u
                return
            } catch {
                Start-Sleep -Milliseconds 500
            }
        }
    } | Out-Null
}

Write-Host "Calm-X is starting at $url"
Write-Host 'Keep this window open while you use the app. Close it or press Ctrl+C to stop.'
python -m backend.main --port $Port

if ($LASTEXITCODE -ne 0) {
    Write-Host 'Calm-X stopped with an error. See the messages above.' -ForegroundColor Red
    Read-Host 'Press Enter to close'
}
