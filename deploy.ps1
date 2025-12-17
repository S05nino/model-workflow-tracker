# ML Workflow Dashboard - Deploy to AWS ECR
# Usage: .\deploy.ps1

# Configuration
$AWS_ACCOUNT = "476443712431"
$AWS_REGION = "eu-central-1"
$AWS_PROFILE = "monitoringecr"
$ECR_REGISTRY = "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"

# Repository names
$FRONTEND_REPO = "ml-workflow-frontend"
$BACKEND_REPO = "ml-workflow-backend"

# Get version tag
$version_tag = Read-Host -Prompt "Enter version tag (e.g., 1.0.0)"

Write-Host "`n=== Building Docker images ===" -ForegroundColor Cyan

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
docker build -t ${FRONTEND_REPO}:$version_tag -f docker/frontend/Dockerfile .

# Build backend
Write-Host "Building backend..." -ForegroundColor Yellow
docker build -t ${BACKEND_REPO}:$version_tag -f docker/backend/Dockerfile docker/backend

Write-Host "`n=== Logging into AWS ECR ===" -ForegroundColor Cyan
aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | docker login --username AWS --password-stdin $ECR_REGISTRY

Write-Host "`n=== Tagging images ===" -ForegroundColor Cyan

# Tag frontend
docker tag ${FRONTEND_REPO}:$version_tag ${ECR_REGISTRY}/${FRONTEND_REPO}:$version_tag
docker tag ${FRONTEND_REPO}:$version_tag ${ECR_REGISTRY}/${FRONTEND_REPO}:latest

# Tag backend
docker tag ${BACKEND_REPO}:$version_tag ${ECR_REGISTRY}/${BACKEND_REPO}:$version_tag
docker tag ${BACKEND_REPO}:$version_tag ${ECR_REGISTRY}/${BACKEND_REPO}:latest

Write-Host "`n=== Pushing images to ECR ===" -ForegroundColor Cyan

# Push frontend
Write-Host "Pushing frontend..." -ForegroundColor Yellow
docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:$version_tag
docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:latest

# Push backend
Write-Host "Pushing backend..." -ForegroundColor Yellow
docker push ${ECR_REGISTRY}/${BACKEND_REPO}:$version_tag
docker push ${ECR_REGISTRY}/${BACKEND_REPO}:latest

Write-Host "`n=== Deploy completed! ===" -ForegroundColor Green
Write-Host "Frontend: ${ECR_REGISTRY}/${FRONTEND_REPO}:$version_tag"
Write-Host "Backend: ${ECR_REGISTRY}/${BACKEND_REPO}:$version_tag"
