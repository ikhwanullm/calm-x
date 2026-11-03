# Creates "Calm-X" and "Stop Calm-X" shortcuts on the Desktop and in the Start Menu.
# Run it once (right-click > Run with PowerShell); run it again after moving the repo folder.
param(
    [switch]$Remove
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $root 'calmx-hidden.vbs'
$icon = Join-Path $root 'assets\calmx.ico'
$folders = @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) '')
)

$shortcuts = @(
    @{ Name = 'Calm-X'; Args = "`"$vbs`""; Description = 'Start Calm-X' },
    @{ Name = 'Stop Calm-X'; Args = "`"$vbs`" stop"; Description = 'Stop the Calm-X server' }
)

$shell = New-Object -ComObject WScript.Shell
foreach ($folder in $folders) {
    foreach ($s in $shortcuts) {
        $path = Join-Path $folder "$($s.Name).lnk"
        if ($Remove) {
            if (Test-Path $path) { Remove-Item $path; Write-Host "Removed $path" }
            continue
        }
        $lnk = $shell.CreateShortcut($path)
        $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
        $lnk.Arguments = $s.Args
        $lnk.WorkingDirectory = $root
        $lnk.IconLocation = $icon
        $lnk.Description = $s.Description
        $lnk.Save()
        Write-Host "Created $path"
    }
}
