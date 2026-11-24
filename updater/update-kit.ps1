# Update the Practice tool kit from a new zip file.
#  1. asks for the zip (or takes the zip dropped on "Update tool kit.bat")
#  2. checks that it is a tool kit zip and shows the old and new version
#  3. warns if someone has a register (DSC, Procedures) open for editing
#  4. backs up the "database" folder to backups\database_<date>.zip
#  5. copies the new files over the tool kit (database, backups, my-settings.js and kit-config.json are never touched)
#  6. creates my-settings.js from the sample the first time
param([string]$Zip)
$ErrorActionPreference = 'Stop'
$Kit = Split-Path -Parent $PSScriptRoot

function Get-KitVersion([string]$dir) {
  $f = Join-Path $dir 'version.js'
  if (-not (Test-Path -LiteralPath $f)) { return $null }
  $t = Get-Content -LiteralPath $f -Raw -Encoding UTF8
  $v = [regex]::Match($t, 'version:\s*(\d+)'); $d = [regex]::Match($t, 'date:\s*"([0-9-]+)"')
  if (-not $v.Success) { return $null }
  return [pscustomobject]@{ Version = [int]$v.Groups[1].Value; Date = $d.Groups[1].Value }
}
function Ask([string]$q) { $a = Read-Host "$q (Y/N)"; return ($a -match '^[Yy]') }

$temp = $null
try {
  Write-Host ''
  Write-Host '=== Update the Practice tool kit ===' -ForegroundColor Cyan
  Write-Host "Tool kit folder: $Kit"
  $old = Get-KitVersion $Kit
  if ($old) { Write-Host ("Installed now:   version {0} ({1})" -f $old.Version, $old.Date) } else { Write-Host 'Installed now:   (version not known)' }

  if (-not $Zip) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = 'Choose the new tool kit zip file'
    $dlg.Filter = 'Tool kit zip (*.zip)|*.zip'
    $dlg.InitialDirectory = Join-Path $env:USERPROFILE 'Downloads'
    if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Write-Host 'No file chosen - nothing was changed.'; return }
    $Zip = $dlg.FileName
  }
  if (-not (Test-Path -LiteralPath $Zip)) { throw "File not found: $Zip" }
  Write-Host "New zip file:    $Zip"

  # unpack to a temporary folder and find the tool kit inside
  $temp = Join-Path $env:TEMP ('kit_update_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
  Expand-Archive -LiteralPath $Zip -DestinationPath $temp -Force
  $src = $null
  foreach ($c in @($temp) + @(Get-ChildItem -LiteralPath $temp -Directory | ForEach-Object { $_.FullName })) {
    if ((Test-Path -LiteralPath (Join-Path $c 'index.html')) -and (Test-Path -LiteralPath (Join-Path $c 'version.js')) -and (Test-Path -LiteralPath (Join-Path $c 'shared'))) { $src = $c; break }
  }
  if (-not $src) { throw 'This zip does not contain the tool kit (index.html, version.js and the shared folder were not found). Nothing was changed.' }
  $new = Get-KitVersion $src
  Write-Host ("In the zip:      version {0} ({1})" -f $new.Version, $new.Date)
  if ($old -and $new.Version -lt $old.Version) {
    if (-not (Ask "The zip has an OLDER version than the one installed. Install it anyway?")) { Write-Host 'Nothing was changed.'; return }
  } elseif ($old -and $new.Version -eq $old.Version) {
    if (-not (Ask "This version is already installed. Install it again?")) { Write-Host 'Nothing was changed.'; return }
  }

  # registers open for editing
  $db = Join-Path $Kit 'database'
  if (Test-Path -LiteralPath $db) {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $busy = @()
    Get-ChildItem -LiteralPath $db -Filter '*.lock' -File -ErrorAction SilentlyContinue | ForEach-Object {
      try { $l = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json; if ($l.beat -and ($now - [int64]$l.beat) -lt 120000) { $busy += ('{0} ({1})' -f $l.user, $_.BaseName) } } catch { }
    }
    if ($busy.Count) {
      Write-Host ('Open for editing now: ' + ($busy -join ', ')) -ForegroundColor Yellow
      if (-not (Ask 'Ask them to close the tool first. Continue anyway?')) { Write-Host 'Nothing was changed.'; return }
    }
    # backup of the database folder
    $files = @(Get-ChildItem -LiteralPath $db -Recurse -File -ErrorAction SilentlyContinue)
    if ($files.Count) {
      $bk = Join-Path $Kit 'backups'; New-Item -ItemType Directory -Force -Path $bk | Out-Null
      $bz = Join-Path $bk ('database_' + (Get-Date -Format 'yyyy-MM-dd_HHmm') + '.zip')
      Compress-Archive -Path (Join-Path $db '*') -DestinationPath $bz -Force
      Write-Host "Database backed up: $bz" -ForegroundColor Green
      # keep the latest 20 backups
      Get-ChildItem -LiteralPath $bk -Filter 'database_*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 20 | Remove-Item -Force
    }
  }

  # copy the new files over the tool kit
  Write-Host 'Copying the new files ...'
  $rc = & robocopy $src $Kit /E /XD database backups /XF my-settings.js kit-config.json /R:2 /W:2 /NFL /NDL /NJH /NJS /NP
  if ($LASTEXITCODE -ge 8) { throw "Copying failed (robocopy code $LASTEXITCODE). Close any open tool files and run the update again. The database backup is in the backups folder." }

  # own settings
  $mine = Join-Path $Kit 'my-settings.js'
  if (-not (Test-Path -LiteralPath $mine)) {
    Copy-Item -LiteralPath (Join-Path $Kit 'my-settings.sample.js') -Destination $mine
    Write-Host 'Created my-settings.js - edit it in Notepad for the firm name and your own notices (kept by future updates).' -ForegroundColor Green
  }

  $now2 = Get-KitVersion $Kit
  Write-Host ''
  Write-Host ("Done. Tool kit version {0} ({1}) is installed." -f $now2.Version, $now2.Date) -ForegroundColor Green
  Write-Host 'Ask everyone to close and reopen the tool kit pages (or press Ctrl+F5).'
} catch {
  Write-Host ''
  Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
  if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Host ''
  Read-Host 'Press Enter to close' | Out-Null
}
