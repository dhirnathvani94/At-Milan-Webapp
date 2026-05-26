# ─────────────────────────────────────────────────────────────────────────────
# Shubh Milan — Clear HSTS Cache for localhost
# Run this ONCE in PowerShell as Administrator to fix the "Upgrade Required" error
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Shubh Milan — Clear HSTS Cache for localhost     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Kill all node processes ──────────────────────────────────────────
Write-Host "  [1/4] Stopping all Node.js processes..." -ForegroundColor Yellow
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | ForEach-Object { Stop-Process -Id $_.Id -Force }
    Write-Host "        Killed $($nodeProcs.Count) node process(es)." -ForegroundColor Green
} else {
    Write-Host "        No node processes running." -ForegroundColor Gray
}
Start-Sleep -Seconds 1

# ── Step 2: Clear Chrome HSTS database for localhost ─────────────────────────
Write-Host "  [2/4] Clearing Chrome HSTS database for localhost..." -ForegroundColor Yellow

$chromeProfiles = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default",
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Profile 1",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Profile 1"
)

$cleared = 0
foreach ($profilePath in $chromeProfiles) {
    $hstsFile = Join-Path $profilePath "TransportSecurity"
    if (Test-Path $hstsFile) {
        try {
            # Read the file and remove localhost entries
            $content = Get-Content $hstsFile -Raw -ErrorAction Stop
            $json = $content | ConvertFrom-Json -ErrorAction Stop
            
            # Remove localhost entries
            $props = $json.PSObject.Properties | Where-Object { $_.Value.sts_include_subdomains -or $_.Name -match "localhost|127\.0\.0\.1" }
            foreach ($prop in $props) {
                $json.PSObject.Properties.Remove($prop.Name)
            }
            
            $json | ConvertTo-Json -Depth 10 | Set-Content $hstsFile -ErrorAction Stop
            Write-Host "        Cleared HSTS from: $profilePath" -ForegroundColor Green
            $cleared++
        } catch {
            Write-Host "        Could not modify $hstsFile (browser may be open)" -ForegroundColor Red
            Write-Host "        → Close Chrome/Edge completely and run this script again" -ForegroundColor Red
        }
    }
}

if ($cleared -eq 0) {
    Write-Host "        No Chrome/Edge HSTS files found (may already be clear)." -ForegroundColor Gray
}

# ── Step 3: Clear Chrome cache ────────────────────────────────────────────────
Write-Host "  [3/4] Clearing Chrome/Edge cache files..." -ForegroundColor Yellow

$cachePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Code Cache"
)

foreach ($cachePath in $cachePaths) {
    if (Test-Path $cachePath) {
        try {
            Remove-Item -Path "$cachePath\*" -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "        Cleared: $cachePath" -ForegroundColor Green
        } catch {
            Write-Host "        Could not clear $cachePath (close browser first)" -ForegroundColor Yellow
        }
    }
}

# ── Step 4: Verify port 3000 is free ─────────────────────────────────────────
Write-Host "  [4/4] Checking port 3000..." -ForegroundColor Yellow
Start-Sleep -Seconds 1
$portInUse = netstat -ano | Select-String ":3000 " | Where-Object { $_ -notmatch "TIME_WAIT" }
if ($portInUse) {
    Write-Host "        WARNING: Port 3000 still in use. Killing..." -ForegroundColor Red
    $pids = ($portInUse | ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] }) | Sort-Object -Unique | Where-Object { $_ -ne "0" }
    foreach ($p in $pids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Write-Host "        Killed PID $p" -ForegroundColor Green
    }
} else {
    Write-Host "        Port 3000 is FREE." -ForegroundColor Green
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ✅ Done! Now do the following:" -ForegroundColor Green
Write-Host ""
Write-Host "  1. Close ALL Chrome/Edge windows completely" -ForegroundColor White
Write-Host "  2. Start the server:  npm run dev" -ForegroundColor White
Write-Host "     (in the project folder)" -ForegroundColor Gray
Write-Host "  3. Open Chrome and go to:  http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  If Chrome still shows 'Upgrade Required':" -ForegroundColor Yellow
Write-Host "  → Open Chrome → address bar → type exactly:" -ForegroundColor Yellow
Write-Host "    chrome://net-internals/#hsts" -ForegroundColor Cyan
Write-Host "  → Under 'Delete domain security policies'" -ForegroundColor Yellow
Write-Host "    type: localhost  → click Delete" -ForegroundColor Yellow
Write-Host ""
