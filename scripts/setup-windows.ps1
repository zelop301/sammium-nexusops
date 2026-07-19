$ErrorActionPreference = "Stop"

Write-Host "Sammium NexusOps Windows setup" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example" -ForegroundColor Green
}

Write-Host "Using the public npm registry..." -ForegroundColor Cyan
npm.cmd config set registry https://registry.npmjs.org/

Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan
npm.cmd install --registry=https://registry.npmjs.org/

Write-Host "Checking Docker Desktop..." -ForegroundColor Cyan
try {
  docker info | Out-Null
} catch {
  Write-Host "Docker Desktop is not running. Open Docker Desktop and wait until the engine says it is running, then rerun this script." -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting PostgreSQL and Redis..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Running database migration..." -ForegroundColor Cyan
npm.cmd run db:migrate

Write-Host "Setup complete. Run: npm.cmd run dev" -ForegroundColor Green
