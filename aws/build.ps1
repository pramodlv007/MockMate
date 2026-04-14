# ─────────────────────────────────────────────────────────────────────────────
# MockMate — Lambda Build Script (Windows PowerShell)
#
# Problem: Lambda handlers import from the backend source tree
#   (e.g. `from services.question.engine import QuestionEngine`)
# but SAM only packages what's inside each lambda/ subdirectory.
#
# Solution: This script copies the required backend modules into each
# Lambda package directory before running `sam build`.
#
# Usage:
#   cd aws
#   .\build.ps1           # copies + builds
#   .\build.ps1 -Deploy   # copies + builds + deploys
# ─────────────────────────────────────────────────────────────────────────────

param(
    [switch]$Deploy = $false,
    [string]$Stage  = "prod"
)

$ErrorActionPreference = "Stop"
$Root     = Split-Path $PSScriptRoot -Parent
$Backend  = Join-Path $Root "backend"
$AwsDir   = $PSScriptRoot

Write-Host "`n=== MockMate Lambda Build ===" -ForegroundColor Cyan

# ── Step 1: Copy shared backend source into each Lambda package ───────────────
$Lambdas = @(
    @{ Dir = "question_generate"; Modules = @("services/question", "services/__init__.py", "common") },
    @{ Dir = "evaluation_trigger"; Modules = @("services/evaluation", "services/question", "services/__init__.py", "common") }
)

foreach ($Lambda in $Lambdas) {
    $LambdaDir = Join-Path $AwsDir "lambda\$($Lambda.Dir)\backend"

    Write-Host "`n→ Preparing $($Lambda.Dir)..." -ForegroundColor Yellow

    # Clean previous copy
    if (Test-Path $LambdaDir) {
        Remove-Item $LambdaDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path "$LambdaDir\services" -Force | Out-Null

    # Copy each required module
    foreach ($Module in $Lambda.Modules) {
        $Src  = Join-Path $Backend $Module
        $Name = Split-Path $Module -Leaf
        $Dst  = Join-Path $LambdaDir (Split-Path $Module -Parent)

        if (-not (Test-Path $Dst)) {
            New-Item -ItemType Directory -Path $Dst -Force | Out-Null
        }

        if (Test-Path $Src -PathType Container) {
            Write-Host "  Copying $Module/ → backend/$Module/" -ForegroundColor Gray
            Copy-Item $Src -Destination (Join-Path $LambdaDir (Split-Path $Module -Parent)) -Recurse -Force
        } elseif (Test-Path $Src -PathType Leaf) {
            Write-Host "  Copying $Module → backend/$Module" -ForegroundColor Gray
            Copy-Item $Src -Destination (Join-Path $LambdaDir (Split-Path $Module -Parent)) -Force
        } else {
            Write-Warning "  Module not found: $Src"
        }
    }

    # Copy shared .env if it exists (for local testing only — prod uses Secrets Manager)
    $EnvFile = Join-Path $Backend ".env"
    if (Test-Path $EnvFile) {
        Copy-Item $EnvFile -Destination $LambdaDir -Force
        Write-Host "  Copied .env (local test only — prod uses Secrets Manager)" -ForegroundColor DarkGray
    }

    Write-Host "  ✔ $($Lambda.Dir) prepared" -ForegroundColor Green
}

# ── Step 2: SAM build ─────────────────────────────────────────────────────────
Write-Host "`n→ Running sam build..." -ForegroundColor Yellow
Set-Location $AwsDir
sam build --use-container

if ($LASTEXITCODE -ne 0) {
    Write-Error "sam build failed"
    exit 1
}
Write-Host "  ✔ sam build complete" -ForegroundColor Green

# ── Step 3: SAM deploy (optional) ─────────────────────────────────────────────
if ($Deploy) {
    Write-Host "`n→ Running sam deploy (Stage=$Stage)..." -ForegroundColor Yellow
    sam deploy --parameter-overrides "Stage=$Stage"

    if ($LASTEXITCODE -ne 0) {
        Write-Error "sam deploy failed"
        exit 1
    }
    Write-Host "  ✔ Deployed to AWS!" -ForegroundColor Green

    # Print outputs
    Write-Host "`n=== Lambda Endpoints ===" -ForegroundColor Cyan
    aws cloudformation describe-stacks `
        --stack-name mockmate `
        --query "Stacks[0].Outputs" `
        --output table
}

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
