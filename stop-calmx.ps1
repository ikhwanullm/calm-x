# Stops the Calm-X server that listens on the port (default 8080). Used by the "Stop Calm-X" shortcut.
# It only stops a process whose command line contains backend.main, never some other program on that port.
param(
    [int]$Port = 8080,
    [switch]$Quiet
)

Add-Type -AssemblyName System.Windows.Forms
function Say($text) {
    if (-not $Quiet) { [System.Windows.Forms.MessageBox]::Show($text, 'Calm-X') | Out-Null }
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
    Say 'Calm-X is not running.'
    exit 0
}

$proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
if (-not $proc -or $proc.CommandLine -notmatch 'backend\.main') {
    Say "Port $Port is used by another program, not Calm-X. Nothing was stopped."
    exit 1
}

Stop-Process -Id $proc.ProcessId -Force
Say 'Calm-X stopped.'
exit 0
