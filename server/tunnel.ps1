# Opens a free Cloudflare quick tunnel to the server (no Cloudflare account) and publishes its
# current address to a secret GitHub gist, which the app reads to find the laptop from anywhere.
# Quick-tunnel addresses change on every start, hence the gist. Runs forever; restarts the tunnel if it drops.
# Started hidden by start-hidden.vbs. Log: tunnel.log. Needs cloudflared and the GitHub CLI (signed in).

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir
$log = Join-Path $dir 'tunnel.log'
$cfLog = Join-Path $dir 'cloudflared.log'
$cloudflared = @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$gh = @("$env:ProgramFiles\GitHub CLI\gh.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1

function Say($msg) { "$(Get-Date -Format s) $msg" | Add-Content $log }

function Get-EnvValue($name) {
  $line = Get-Content (Join-Path $dir '.env') -ErrorAction SilentlyContinue | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if ($line) { ($line -split '=', 2)[1].Trim() } else { '' }
}

function Set-EnvValue($name, $value) {
  $path = Join-Path $dir '.env'
  $lines = @(Get-Content $path -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch "^$name=" })
  $lines += "$name=$value"
  [IO.File]::WriteAllLines($path, [string[]]$lines)
}

function Publish($url) {
  # gh prints progress on stderr; in Windows PowerShell that would count as an error under 'Stop'.
  $ErrorActionPreference = 'Continue'
  $file = Join-Path $env:TEMP 'tend-laptop.json'
  # WriteAllText writes UTF-8 without a BOM (Set-Content -Encoding utf8 adds one, which breaks JSON parsing).
  [IO.File]::WriteAllText($file, (@{ url = $url; updated = (Get-Date).ToString('o') } | ConvertTo-Json -Compress))
  $id = Get-EnvValue 'TUNNEL_GIST_ID'
  if ($id) {
    & $gh gist edit $id --filename tend-laptop.json $file 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Say "published $url to gist $id"; return }
    Say "gist edit failed (exit $LASTEXITCODE); creating a new gist"
  }
  # Secret gist: unlisted, readable only by someone with its link. It holds only the address, never the token.
  $out = & $gh gist create --desc 'Tend laptop address (updated automatically)' $file 2>&1
  $match = $out | ForEach-Object { "$_" } | Select-String -Pattern 'gist\.github\.com/(?:[^/]+/)?([0-9a-f]+)' | Select-Object -First 1
  if (-not $match) { Say "gist create failed: $($out -join ' ')"; return }
  $newId = $match.Matches[0].Groups[1].Value
  Set-EnvValue 'TUNNEL_GIST_ID' $newId
  Say "created gist $newId and published $url"
}

if ((Get-EnvValue 'ENABLE_TUNNEL') -ne 'true') { exit 0 }  # off unless ENABLE_TUNNEL=true in .env
if (-not $cloudflared) { Say 'cloudflared not found; install it with: winget install Cloudflare.cloudflared'; exit 1 }
if (-not $gh) { Say 'GitHub CLI not found'; exit 1 }

while ($true) {
  Remove-Item $cfLog -ErrorAction SilentlyContinue
  Say 'starting cloudflared'
  $proc = Start-Process -FilePath $cloudflared -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:8000', '--logfile', "`"$cfLog`"" -WindowStyle Hidden -PassThru
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url -and -not $proc.HasExited; $i++) {
    Start-Sleep -Seconds 2
    $m = Select-String -Path $cfLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
  if ($url) {
    try { Publish $url } catch { Say "publish failed: $_" }
  } else {
    Say 'no tunnel address after 2 minutes'
  }
  # Watchdog: after the laptop sleeps, Cloudflare deletes the quick tunnel but cloudflared keeps retrying it
  # forever ("Tunnel not found"). So check the public address every 30 s; after 2 failures in a row,
  # kill cloudflared and let the loop open a new tunnel (and publish its new address).
  $fails = 0
  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 30
    if (-not $url) { $fails = 2 }
    else {
      try {
        Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 20 | Out-Null
        $fails = 0
      } catch {
        # An HTTP error (401 without the token) still proves the tunnel works; only a failed connection counts.
        if ($_.Exception.Response) { $fails = 0 } else { $fails++ }
      }
    }
    if ($fails -ge 2) {
      Say "tunnel $url not answering; opening a new one"
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      break
    }
  }
  Say "cloudflared stopped; restarting in 5 s"
  Start-Sleep -Seconds 5
}
