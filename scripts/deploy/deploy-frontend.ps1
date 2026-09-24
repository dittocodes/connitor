<#
.SYNOPSIS
  Build Next.js static export and publish to AWS Amplify (manual hosting deploy).

.DESCRIPTION
  1) npm ci / npm run build  → frontend/dist
  2) zip dist
  3) aws amplify create-deployment → upload zip → start-deployment
  4) poll until SUCCEED

.EXAMPLE
  .\scripts\deploy\deploy-frontend.ps1
  .\scripts\deploy\deploy-frontend.ps1 -SkipBuild
#>
[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$CreateApp
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Import-DeployConfig
Assert-Command aws
Assert-Command npm

$appId = $env:AMPLIFY_APP_ID
$branch = if ($env:AMPLIFY_BRANCH) { $env:AMPLIFY_BRANCH } else { 'staging' }
$region = if ($env:AMPLIFY_REGION) { $env:AMPLIFY_REGION } else { 'ap-south-1' }
$apiUrl = $env:NEXT_PUBLIC_BACKEND_API_URL
if (-not $apiUrl) { throw 'NEXT_PUBLIC_BACKEND_API_URL is required in config.env' }

function Test-AmplifyApp([string]$Id, [string]$Reg) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  aws amplify get-app --app-id $Id --region $Reg 1>$null 2>$null
  $ok = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $prev
  return $ok
}

if (-not $appId -or -not (Test-AmplifyApp $appId $region)) {
  if (-not $CreateApp -and $appId) {
    Write-Host @"
Amplify app '$appId' was not found in region $region for the current AWS identity.
It likely lives in another AWS account. Options:
  1) Switch AWS credentials to the account that owns $appId
  2) Re-run with -CreateApp to create 'connitor' in this account
"@ -ForegroundColor Yellow
    throw "Amplify app not found: $appId"
  }
  Write-Host "==> Creating Amplify app 'connitor' in $region" -ForegroundColor Cyan
  $createdApp = aws amplify create-app `
    --name connitor `
    --platform WEB `
    --region $region `
    --output json | ConvertFrom-Json
  $appId = $createdApp.app.appId
  $env:AMPLIFY_APP_ID = $appId
  Write-Host "Created appId=$appId"
  aws amplify create-branch --app-id $appId --branch-name $branch --region $region | Out-Null
  # SPA rewrite
  aws amplify update-app --app-id $appId --region $region `
    --custom-rules "[{`"source`":`"/<*>`",`"target`":`"/index.html`",`"status`":`"404-200`"}]" | Out-Null
}

if (-not $appId) { throw 'AMPLIFY_APP_ID is required' }

$root = Get-RepoRoot
$frontend = Join-Path $root 'frontend'
$dist = Join-Path $frontend 'dist'
$zipPath = Join-Path $env:TEMP ("connitor-amplify-{0}.zip" -f (Get-Date -Format 'yyyyMMddHHmmss'))

Push-Location $frontend
try {
  if (-not $SkipBuild) {
    Write-Host "==> Building frontend (API=$apiUrl)" -ForegroundColor Cyan
    $env:NEXT_PUBLIC_BACKEND_API_URL = $apiUrl
    # Prevent .env.local empty NEXT_PUBLIC_* from winning over deploy config
    $prodLocal = Join-Path $frontend '.env.production.local'
    @"
NEXT_PUBLIC_BACKEND_API_URL=$apiUrl
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_DEMO_MODE=false
"@ | Set-Content -Path $prodLocal -Encoding utf8
    # Do NOT set NODE_ENV=production before build — npm would skip installing
    # TypeScript (devDependency) when Next loads next.config.ts.
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    if (-not (Test-Path 'node_modules')) {
      if (Test-Path 'package-lock.json') { npm ci } else { npm install }
    } else {
      Write-Host "    using existing node_modules (skip npm ci)"
    }
    # Next prints warnings on stderr; with output redirected, 'Stop' would abort on them.
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    npm run build
    $buildExit = $LASTEXITCODE
    $ErrorActionPreference = $prevPref
    Remove-Item $prodLocal -Force -ErrorAction SilentlyContinue
    if ($buildExit -ne 0) { throw "npm run build failed (exit $buildExit)" }
  }

  if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw "frontend/dist/index.html missing. Build failed or SkipBuild without dist."
  }

  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Write-Host "==> Zipping $dist → $zipPath (forward-slash paths)" -ForegroundColor Cyan
  # Compress-Archive stores Windows backslashes; Amplify/Linux then fails to serve /_next/*
  $py = Join-Path (Get-RepoRoot) 'python_backend\.venv\Scripts\python.exe'
  if (-not (Test-Path $py)) { $py = 'python' }
  $zipPy = @"
import zipfile
from pathlib import Path
root = Path(r'''$dist''')
out = Path(r'''$zipPath''')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for path in root.rglob('*'):
        if path.is_file():
            zf.write(path, path.relative_to(root).as_posix())
print(f'zipped {sum(1 for _ in zipfile.ZipFile(out).namelist())} files')
"@
  & $py -c $zipPy
  if ($LASTEXITCODE -ne 0) { throw 'Failed to build Amplify zip with forward-slash paths' }

  Write-Host "==> Creating Amplify deployment ($appId / $branch)" -ForegroundColor Cyan
  $created = aws amplify create-deployment `
    --app-id $appId `
    --branch-name $branch `
    --region $region `
    --output json | ConvertFrom-Json

  $jobId = $created.jobId
  $uploadUrl = $created.zipUploadUrl
  if (-not $jobId -or -not $uploadUrl) {
    throw "create-deployment did not return jobId/zipUploadUrl: $($created | ConvertTo-Json -Compress)"
  }

  Write-Host "==> Uploading zip (job $jobId)" -ForegroundColor Cyan
  # Amplify expects PUT of the zip bytes to the pre-signed URL
  Invoke-WebRequest -Uri $uploadUrl -Method Put -InFile $zipPath -ContentType 'application/zip' -UseBasicParsing | Out-Null

  Write-Host "==> Starting deployment" -ForegroundColor Cyan
  aws amplify start-deployment `
    --app-id $appId `
    --branch-name $branch `
    --job-id $jobId `
    --region $region | Out-Null

  Write-Host "==> Waiting for Amplify job $jobId" -ForegroundColor Cyan
  $deadline = (Get-Date).AddMinutes(20)
  do {
    Start-Sleep -Seconds 8
    $job = aws amplify get-job `
      --app-id $appId `
      --branch-name $branch `
      --job-id $jobId `
      --region $region `
      --output json | ConvertFrom-Json
    $status = $job.job.summary.status
    Write-Host "    status=$status"
    if ($status -in @('SUCCEED', 'FAILED', 'CANCELLED')) { break }
  } while ((Get-Date) -lt $deadline)

  if ($status -ne 'SUCCEED') {
    throw "Amplify deploy finished with status=$status (job $jobId)"
  }

  Write-Host "Frontend deployed to Amplify app $appId branch $branch" -ForegroundColor Green
  if ($env:FRONTEND_HEALTH_URL) {
    Wait-HttpOk -Url $env:FRONTEND_HEALTH_URL -Attempts 8 -DelaySec 8
  }
} finally {
  Pop-Location
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force -ErrorAction SilentlyContinue }
}
