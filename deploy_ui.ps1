$server = "root@178.128.53.91"
$remotePath = "/var/www/ai-customer-checker/ui"
$sshKey = "$env:USERPROFILE\.ssh\do_deploy_key"
$localPath = "C:\laragon\www\Ai-Customer-Data-Checker\ui\ai-courier-dashboard-V0.APP\out"

scp -q -o StrictHostKeyChecking=no -i $sshKey -r "$localPath\*" "${server}:${remotePath}/"
