# MockMate - Local Development Startup Script
# Starts all 6 microservices in separate windows
# Prerequisites: pip install -r requirements.txt, postgres+redis running via docker-compose.dev.yml

$BackendDir = "$PSScriptRoot\backend"

function Start-Service {
    param([string]$Name, [string]$Module, [int]$Port)
    $cmd = "cd '$BackendDir'; `$env:PYTHONPATH='$BackendDir'; uvicorn ${Module}:app --host 0.0.0.0 --port $Port --reload"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd -WindowStyle Normal
    Write-Host "Started $Name on port $Port" -ForegroundColor Green
    Start-Sleep -Milliseconds 800
}

Write-Host "Starting MockMate Microservices..." -ForegroundColor Cyan

# Start all 6 services
Start-Service "Gateway"    "services.gateway.main"    8000
Start-Service "Auth"       "services.auth.main"       8001
Start-Service "Profile"    "services.profile.main"    8002
Start-Service "Question"   "services.question.main"   8003
Start-Service "Interview"  "services.interview.main"  8004
Start-Service "Evaluation" "services.evaluation.main" 8005

Write-Host "All services started!" -ForegroundColor Cyan
Write-Host "  Gateway:    http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Auth:       http://localhost:8001/docs" -ForegroundColor White
Write-Host "  Profile:    http://localhost:8002/docs" -ForegroundColor White
Write-Host "  Question:   http://localhost:8003/docs" -ForegroundColor White
Write-Host "  Interview:  http://localhost:8004/docs" -ForegroundColor White
Write-Host "  Evaluation: http://localhost:8005/docs" -ForegroundColor White
Write-Host "  Frontend:   cd frontend and run npm run dev" -ForegroundColor Yellow
