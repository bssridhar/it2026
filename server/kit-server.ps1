# Practice tool kit - server for the office LAN (Windows PowerShell 5.1, no installation needed).
#
#   Start:  double-click "Start tool kit server.bat" in the tool kit folder.
#   Setup:  once, right-click "Set up tool kit server (run as administrator).bat" -> Run as administrator
#           (allows other computers to connect: URL reservation and a Windows firewall rule for the port).
#   Hidden: "Start tool kit server (hidden).vbs" runs it with no window (-Hidden); "Stop tool kit server.bat" stops it (-Stop).
#   Log:    server\server.log (start, stop, errors).
#
# Serves the tool kit at http://<this computer>:<port>/ and keeps the shared registers (DSC Register,
# Checklists and Procedures) as JSON files in the data folder named in kit-config.json:
#   { "port": 8080, "dataFolder": "database" }      (a relative folder is inside the tool kit folder)
# Data API (used by shared/db.js):
#   GET  /api/info                      -> {"server":true,"computer":..,"dataFolder":..,"files":[..]}
#   GET  /api/db/<name>                 -> {"data":<register or null>,"modified":<ms>}
#   PUT  /api/db/<name>?known=<ms>      -> {"ok":true,"modified":<ms>} | 409 {"conflict":true,"other":<register>}
#   POST /api/lock/<name>   {user,session,force} -> {"ok":true,..} | {"busy":true,"lock":{..}}
#   POST /api/beat/<name>   {user,session}       -> {"ok":true} | {"lost":true,"lock":{..}}
#   GET  /api/lock/<name>                        -> lock or null
#   POST /api/unlock/<name> {session}            -> {"ok":true}
param([switch]$Setup, [switch]$Hidden, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$Kit = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$STALE_MS = 120000
$NAMES = @('dsc_register', 'procedures_library')
$LOG = Join-Path $PSScriptRoot 'server.log'
function Log([string]$t) {
  try {
    if ((Test-Path -LiteralPath $LOG) -and (Get-Item -LiteralPath $LOG).Length -gt 1MB) { Move-Item -LiteralPath $LOG -Destination ($LOG + '.old') -Force }
    Add-Content -LiteralPath $LOG -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $t) -Encoding UTF8
  } catch { }
}
function Pause-End { if (-not $Hidden) { Read-Host 'Press Enter to close' | Out-Null } }

if ($Stop) {
  $mine = $PID
  $p = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.ProcessId -ne $mine -and $_.CommandLine -like '*kit-server.ps1*' -and $_.CommandLine -notlike '*-Stop*' -and $_.CommandLine -notlike '*-Setup*' })
  if ($p.Count) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Log 'Stopped (Stop tool kit server).'; Write-Host 'The tool kit server has been stopped.' -ForegroundColor Green }
  else { Write-Host 'The tool kit server was not running.' }
  Start-Sleep -Seconds 3
  return
}

function Read-Config {
  $f = Join-Path $Kit 'kit-config.json'
  if (-not (Test-Path -LiteralPath $f)) {
    $sample = Join-Path $Kit 'kit-config.sample.json'
    if (Test-Path -LiteralPath $sample) { Copy-Item -LiteralPath $sample -Destination $f }
    else { [IO.File]::WriteAllText($f, '{ "port": 8080, "dataFolder": "database" }', $utf8) }
  }
  $c = Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json
  $port = 8080; if ($c.port) { $port = [int]$c.port }
  $df = 'database'; if ($c.dataFolder) { $df = [string]$c.dataFolder }
  if (-not [IO.Path]::IsPathRooted($df)) { $df = Join-Path $Kit $df }
  return [pscustomobject]@{ Port = $port; Data = [IO.Path]::GetFullPath($df); File = $f }
}

$cfg = Read-Config

if ($Setup) {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) { Write-Host 'Please right-click the setup file and choose "Run as administrator".' -ForegroundColor Red; Read-Host 'Press Enter to close' | Out-Null; return }
  Write-Host ("Setting up port {0} ..." -f $cfg.Port)
  & netsh http delete urlacl url=("http://+:{0}/" -f $cfg.Port) 2>&1 | Out-Null
  & netsh http add urlacl url=("http://+:{0}/" -f $cfg.Port) sddl="D:(A;;GX;;;WD)"
  & netsh advfirewall firewall delete rule name="Practice tool kit server" 2>&1 | Out-Null
  & netsh advfirewall firewall add rule name="Practice tool kit server" dir=in action=allow protocol=TCP localport=$($cfg.Port)
  Write-Host 'Done. Now start the server with "Start tool kit server.bat" (no administrator rights needed).' -ForegroundColor Green
  Read-Host 'Press Enter to close' | Out-Null
  return
}

New-Item -ItemType Directory -Force -Path $cfg.Data | Out-Null
$TYPES = @{ '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8';
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif';
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.pdf' = 'application/pdf'; '.docx' = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  '.xlsx' = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; '.xls' = 'application/vnd.ms-excel'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8';
  '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'; '.map' = 'application/json' }
$BLOCKED = @('database', 'backups', 'kit-config.json', 'updater', 'server')

function Now-Ms { return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function Mtime-Ms([string]$f) { return ([DateTimeOffset]([IO.File]::GetLastWriteTimeUtc($f))).ToUnixTimeMilliseconds() }
function Send([System.Net.HttpListenerResponse]$res, [int]$code, [string]$type, [byte[]]$bytes) {
  $res.StatusCode = $code; $res.ContentType = $type
  $res.Headers['Cache-Control'] = 'no-cache'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}
function Send-Json($res, [int]$code, [string]$json) { Send $res $code 'application/json; charset=utf-8' $utf8.GetBytes($json) }
function Q([string]$s) { return '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"' }
function Read-Body($req) { $sr = New-Object IO.StreamReader($req.InputStream, $utf8); try { return $sr.ReadToEnd() } finally { $sr.Close() } }
function Write-Atomic([string]$f, [string]$text) {
  $tmp = $f + '.tmp'; [IO.File]::WriteAllText($tmp, $text, $utf8)
  # (not File.Replace: PowerShell passes $null for its backup path as "" - "The path is not of a legal form")
  [IO.File]::Copy($tmp, $f, $true)
  [IO.File]::Delete($tmp)
}
function Lock-Json([string]$user, [string]$session, [int64]$since, [int64]$beat) {
  return '{"user":' + (Q $user) + ',"session":' + (Q $session) + ',"since":' + $since + ',"beat":' + $beat + '}'
}
function Read-Lock([string]$name) {
  $f = Join-Path $cfg.Data ($name + '.lock')
  if (-not (Test-Path -LiteralPath $f)) { return $null }
  try { return (Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Handle-Api($req, $res, [string]$path) {
  $parts = $path.Trim('/').Split('/')   # api, op, name
  $op = $parts[1]
  if ($op -eq 'info') {
    $files = @(Get-ChildItem -LiteralPath $cfg.Data -Filter '*.json' -File -ErrorAction SilentlyContinue | ForEach-Object { Q $_.Name })
    Send-Json $res 200 ('{"server":true,"computer":' + (Q $env:COMPUTERNAME) + ',"dataFolder":' + (Q $cfg.Data) + ',"dataName":' + (Q (Split-Path -Leaf $cfg.Data)) + ',"lan":' + ($(if ($global:LanOk) { 'true' } else { 'false' })) + ',"files":[' + ($files -join ',') + ']}')
    return
  }
  $name = $parts[2]
  if ($NAMES -notcontains $name) { Send-Json $res 404 '{"error":"unknown register"}'; return }
  $file = Join-Path $cfg.Data ($name + '.json')
  $lockf = Join-Path $cfg.Data ($name + '.lock')
  $m = $req.HttpMethod
  if ($op -eq 'db' -and $m -eq 'GET') {
    if (Test-Path -LiteralPath $file) {
      $t = [IO.File]::ReadAllText($file, $utf8); if (-not $t.Trim()) { $t = 'null' }
      Send-Json $res 200 ('{"data":' + $t + ',"modified":' + (Mtime-Ms $file) + '}')
    } else { Send-Json $res 200 '{"data":null,"modified":null}' }
    return
  }
  if ($op -eq 'db' -and $m -eq 'PUT') {
    $body = Read-Body $req
    if (-not $body.TrimStart().StartsWith('{')) { Send-Json $res 400 '{"error":"not a register"}'; return }
    if (Test-Path -LiteralPath $file) {
      $known = $req.QueryString['known']
      $cur = Mtime-Ms $file
      if ($known -and $known -ne 'null' -and [int64]$known -ne $cur) {
        $t = [IO.File]::ReadAllText($file, $utf8); if (-not $t.Trim()) { $t = 'null' }
        Send-Json $res 409 ('{"conflict":true,"other":' + $t + '}'); return
      }
      $bd = Join-Path $cfg.Data 'backup'; New-Item -ItemType Directory -Force -Path $bd | Out-Null
      $bf = Join-Path $bd ($name + '_' + (Get-Date -Format 'yyyy-MM-dd') + '.json')
      if (-not (Test-Path -LiteralPath $bf)) { Copy-Item -LiteralPath $file -Destination $bf }
    }
    Write-Atomic $file $body
    Send-Json $res 200 ('{"ok":true,"modified":' + (Mtime-Ms $file) + '}')
    return
  }
  if ($op -eq 'lock' -and $m -eq 'GET') {
    if (Test-Path -LiteralPath $lockf) { Send-Json $res 200 ([IO.File]::ReadAllText($lockf, $utf8)) } else { Send-Json $res 200 'null' }
    return
  }
  if ($op -eq 'lock' -and $m -eq 'POST') {
    $b = Read-Body $req | ConvertFrom-Json
    $l = Read-Lock $name; $now = Now-Ms
    $other = $l -and $l.session -ne $b.session
    if ($other -and -not $b.force -and ($now - [int64]$l.beat) -lt $STALE_MS) {
      Send-Json $res 200 ('{"busy":true,"lock":' + (Lock-Json $l.user $l.session ([int64]$l.since) ([int64]$l.beat)) + '}'); return
    }
    $since = $now; if ($l -and $l.session -eq $b.session) { $since = [int64]$l.since }
    $mine = Lock-Json $b.user $b.session $since $now
    Write-Atomic $lockf $mine
    $stale = 'null'
    if ($other -and ($now - [int64]$l.beat) -ge $STALE_MS) { $stale = Lock-Json $l.user $l.session ([int64]$l.since) ([int64]$l.beat) }
    Send-Json $res 200 ('{"ok":true,"lock":' + $mine + ',"stale":' + $stale + '}')
    return
  }
  if ($op -eq 'beat' -and $m -eq 'POST') {
    $b = Read-Body $req | ConvertFrom-Json
    $l = Read-Lock $name
    if ($l -and $l.session -ne $b.session) { Send-Json $res 200 ('{"lost":true,"lock":' + (Lock-Json $l.user $l.session ([int64]$l.since) ([int64]$l.beat)) + '}'); return }
    $since = Now-Ms; if ($l) { $since = [int64]$l.since }
    Write-Atomic $lockf (Lock-Json $b.user $b.session $since (Now-Ms))
    Send-Json $res 200 '{"ok":true}'
    return
  }
  if ($op -eq 'unlock' -and $m -eq 'POST') {
    $b = Read-Body $req | ConvertFrom-Json
    $l = Read-Lock $name
    if ($l -and $l.session -eq $b.session) { Remove-Item -LiteralPath $lockf -Force -ErrorAction SilentlyContinue }
    Send-Json $res 200 '{"ok":true}'
    return
  }
  Send-Json $res 405 '{"error":"not allowed"}'
}

function Handle-File($req, $res, [string]$path) {
  $rel = $path.TrimStart('/')
  if ($rel -eq '') { $rel = 'index.html' }
  $first = ($rel.Split('/')[0]).ToLower()
  if ($BLOCKED -contains $first -or $rel.Contains('..')) { Send $res 403 'text/plain' $utf8.GetBytes('Not available'); return }
  $full = [IO.Path]::GetFullPath((Join-Path $Kit ($rel -replace '/', '\')))
  if (-not $full.StartsWith($Kit, [StringComparison]::OrdinalIgnoreCase)) { Send $res 403 'text/plain' $utf8.GetBytes('Not available'); return }
  if (Test-Path -LiteralPath $full -PathType Container) {
    if (-not $path.EndsWith('/')) { $res.StatusCode = 301; $res.RedirectLocation = $path + '/'; return }
    $full = Join-Path $full 'index.html'
  }
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { Send $res 404 'text/plain' $utf8.GetBytes('Not found'); return }
  $ext = [IO.Path]::GetExtension($full).ToLower()
  $type = $TYPES[$ext]; if (-not $type) { $type = 'application/octet-stream' }
  Send $res 200 $type ([IO.File]::ReadAllBytes($full))
}

# ---- start ----
$listener = New-Object System.Net.HttpListener
$lanOk = $true
$listener.Prefixes.Add(("http://+:{0}/" -f $cfg.Port))
try { $listener.Start() } catch {
  $lanOk = $false
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add(("http://localhost:{0}/" -f $cfg.Port))
  try { $listener.Start() } catch {
    $msg = ("Could not start on port {0}: {1}" -f $cfg.Port, $_.Exception.Message)
    Log ($msg + ' (Is the server already running? Another program may be using the port - change "port" in kit-config.json and run the setup again.)')
    Write-Host $msg -ForegroundColor Red; Write-Host 'Is the server already running? Another program may be using the port - change "port" in kit-config.json and run the setup again.'; Pause-End; return }
}
$host.UI.RawUI.WindowTitle = 'Practice tool kit server - keep this window open'
$global:LanOk = $lanOk
if ($lanOk) { Log ("Started: http://{0}:{1}/  data folder {2}" -f $env:COMPUTERNAME, $cfg.Port, $cfg.Data) } else { Log ("Started for this computer only (http://localhost:{0}/) - run the setup as administrator for the other computers.  data folder {1}" -f $cfg.Port, $cfg.Data) }
Write-Host ''
Write-Host '=== Practice tool kit server ===' -ForegroundColor Cyan
Write-Host ("Data folder:  {0}" -f $cfg.Data)
if ($lanOk) {
  Write-Host ''
  Write-Host 'Open the tool kit on any computer in the office at:' -ForegroundColor Green
  Write-Host ("    http://{0}:{1}/" -f $env:COMPUTERNAME, $cfg.Port) -ForegroundColor Green
  try { Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { Write-Host ("    http://{0}:{1}/" -f $_.IPAddress, $cfg.Port) } } catch { }
} else {
  Write-Host ''
  Write-Host 'Running for THIS computer only:' -ForegroundColor Yellow
  Write-Host ("    http://localhost:{0}/" -f $cfg.Port) -ForegroundColor Yellow
  Write-Host 'For the other computers, run "Set up tool kit server (run as administrator).bat" once (right-click -> Run as administrator), then start the server again.' -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Keep this window open (it can be minimised). Close it to stop the server.'
Write-Host ''

while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.StartsWith('/api/')) { Handle-Api $ctx.Request $ctx.Response $path } else { Handle-File $ctx.Request $ctx.Response $path }
  } catch {
    try { Log ('Error: ' + $_.Exception.Message); Write-Host ((Get-Date -Format 'HH:mm:ss') + ' ' + $_.Exception.Message) -ForegroundColor DarkYellow; if ($ctx) { Send-Json $ctx.Response 500 ('{"error":' + (Q $_.Exception.Message) + '}') } } catch { }
  } finally {
    if ($ctx) { try { $ctx.Response.Close() } catch { } }
  }
}
