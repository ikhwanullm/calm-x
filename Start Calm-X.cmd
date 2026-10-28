@echo off
rem Double-click to start Calm-X. Runs start-calmx.ps1 next to this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-calmx.ps1" %*
