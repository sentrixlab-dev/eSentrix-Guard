# Ai-Customer-Data-Checker - One-Command Deployment Script
# Usage: .\deploy.ps1

$server = "root@178.128.53.91"
$remotePath = "/var/www/ai-customer-checker"
$sshKey = "$env:USERPROFILE\.ssh\do_deploy_key"
$localPath = "C:\laragon\www\Ai-Customer-Data-Checker"
$tempDir = "C:\Users\arraa\AppData\Local\Temp\ai-checker-deploy"

Write-Host "=== Preparing deployment files ===" -ForegroundColor Cyan

# Clean temp directory
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy files excluding node_modules, caches, etc.
$exclude = @('node_modules', '.wwebjs_auth', '.wwebjs_cache', 'chrome-headless-shell', '.git', 'deploy.ps1', 'database.sqlite', 'database.sqlite-wal', 'database.sqlite-shm', 'scratch')
Get-ChildItem -Path $localPath -Exclude $exclude | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
}

Write-Host "Files prepared. Uploading to server..." -ForegroundColor Yellow

# Upload via SCP
$result = scp -q -o StrictHostKeyChecking=no -i $sshKey -r "$tempDir\*" "${server}:${remotePath}/" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "SCP failed: $result" -ForegroundColor Red
    exit 1
}

Write-Host "Upload complete. Restarting app..." -ForegroundColor Yellow

# Restart PM2 and check logs
ssh -o StrictHostKeyChecking=no -i $sshKey $server "pm2 restart ai-customer-checker" 2>&1

Write-Host ""
Write-Host "=== DEPLOYMENT COMPLETE ===" -ForegroundColor Green
Write-Host "Site: https://ai-checker.luxo.com.bd" -ForegroundColor Cyan
Write-Host ""

# Clean up
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
