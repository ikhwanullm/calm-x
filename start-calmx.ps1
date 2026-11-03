# Calm-X launcher: rebuilds the frontend when needed, starts the server
# and opens the app in the browser.
#
# Default (Start Calm-X.cmd): the server runs in this window. Close it (or Ctrl+C) to stop.
# -Background (shortcuts via calmx-hidden.vbs): no window. The server runs hidden, logs go to
#   logs\server.log, and Calm-X opens in its own app window. Stop it with stop-calmx.ps1.
# -SkipBuild: never rebuild the frontend (for testing against another dist folder).
param(
    [int]$Port = 8080,
    [switch]$NoBrowser,
    [switch]$Background,
    [switch]$SkipBuild
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:$Port"
Set-Location $root

function Test-Server {
    try {
        Invoke-WebRequest "$url/api/settings" -UseBasicParsing -TimeoutSec 1 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Show-Error($message) {
    if ($Background) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($message, 'Calm-X', 'OK', 'Error') | Out-Null
    } else {
        Write-Host $message -ForegroundColor Red
        Read-Host 'Press Enter to close'
    }
}

# Calm-X in its own window without tabs or address bar (Edge, then Chrome); the default browser as a last resort.
# The ?v= part is a new address every time, so a copy of the page that the browser cached before the server
# started sending "no-cache" (or any older copy) is never reused.
function Open-App {
    $appUrl = "$url/?v=$(Get-Date -Format 'yyyyMMddHHmmss')"
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($exe in $candidates) {
        if (Test-Path $exe) {
            Start-Process $exe -ArgumentList "--app=$appUrl"
            return
        }
    }
    Start-Process $appUrl
}

# Rebuild only when the build is missing or a source file changed after it.
function Test-NeedsBuild {
    $index = Join-Path $root 'frontend\dist\index.html'
    if (-not (Test-Path $index)) { return $true }
    $builtAt = (Get-Item $index).LastWriteTime
    $changed = Get-ChildItem (Join-Path $root 'frontend\src') -Recurse -File |
        Where-Object { $_.LastWriteTime -gt $builtAt } |
        Select-Object -First 1
    return $null -ne $changed
}

if ($Background) {
    $logs = Join-Path $root 'logs'
    New-Item -ItemType Directory -Force $logs | Out-Null
    $serverLog = Join-Path $logs 'server.log'

    # Already running: just open the window, never start a second server.
    if (Test-Server) {
        if (-not $NoBrowser) { Open-App }
        exit 0
    }

    if (-not $SkipBuild -and (Test-NeedsBuild)) {
        $buildLog = Join-Path $logs 'build.log'
        Push-Location (Join-Path $root 'frontend')
        cmd /c "npm run build > ""$buildLog"" 2>&1"
        $buildOk = $LASTEXITCODE -eq 0
        Pop-Location
        if (-not $buildOk) {
            Show-Error "The frontend build failed. See $buildLog"
            exit 1
        }
    }

    Start-Process python -ArgumentList '-m', 'backend.main', '--port', $Port -WindowStyle Hidden `
        -RedirectStandardOutput $serverLog -RedirectStandardError (Join-Path $logs 'server.err.log')

    for ($i = 0; $i -lt 60; $i++) {
        if (Test-Server) { break }
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Server)) {
        Show-Error "Calm-X did not start. See $serverLog and logs\server.err.log (is port $Port used by another program?)"
        exit 1
    }
    if (-not $NoBrowser) { Open-App }
    exit 0
}

# Visible mode (Start Calm-X.cmd)
$host.UI.RawUI.WindowTitle = "Calm-X ($url)"

if (-not $SkipBuild -and (Test-NeedsBuild)) {
    Write-Host 'Building the frontend...'
    Push-Location (Join-Path $root 'frontend')
    npm run build
    $buildOk = $LASTEXITCODE -eq 0
    Pop-Location
    if (-not $buildOk) {
        Show-Error 'Build failed. See the messages above.'
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
                Start-Process "$u/?v=$(Get-Date -Format 'yyyyMMddHHmmss')"
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
    Show-Error 'Calm-X stopped with an error. See the messages above.'
}
