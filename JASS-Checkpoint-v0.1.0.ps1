$ErrorActionPreference = "Stop"
$Project = "D:\Github\JASS-Signal-Intelligence-Studio"
Set-Location $Project

Write-Host "`nJASS Signal Intelligence Studio — A01-A03 checkpoint" -ForegroundColor Cyan
Write-Host "Project: $Project"

# Keep local backups and the one-time patch script out of Git.
$ignoreFile = Join-Path $Project ".gitignore"
$ignoreAdds = @("*.bak", "JASS-Apply-India-Canada-Focus.ps1")
$existing = if (Test-Path $ignoreFile) { Get-Content $ignoreFile } else { @() }
foreach ($entry in $ignoreAdds) {
    if ($existing -notcontains $entry) {
        Add-Content -Path $ignoreFile -Value $entry -Encoding utf8
    }
}

# Initialize Git only if this directory is not already a repository.
$inside = $false
git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -eq 0) { $inside = $true }

if (-not $inside) {
    Write-Host "`nNo Git repository found; initializing a local repository." -ForegroundColor Yellow
    git init -b main
    if ($LASTEXITCODE -ne 0) { throw "git init failed." }
}

# Stage current project changes, then refuse to commit common generated/private files.
git add -A
if ($LASTEXITCODE -ne 0) { throw "git add failed." }

$staged = @(git diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect staged files." }

$blocked = @($staged | Where-Object {
    $_ -match '(^|/)(node_modules|dist|release|coverage|\.git)(/|$)' -or
    $_ -match '(^|/)\.env($|\.)' -or
    $_ -match '\.(sqlite|sqlite3|db|bak)$'
})
if ($blocked.Count -gt 0) {
    Write-Host "`nUnsafe/generated paths are staged; refusing to commit:" -ForegroundColor Red
    $blocked | ForEach-Object { Write-Host "  $_" }
    Write-Host "Review .gitignore, unstage those files, and rerun this script."
    exit 1
}

if ($staged.Count -eq 0) {
    Write-Host "`nNothing to commit. The working tree may already be clean." -ForegroundColor Yellow
    git status --short --branch
    exit 0
}

Write-Host "`nFiles included in this checkpoint:" -ForegroundColor Cyan
$staged | ForEach-Object { Write-Host "  $_" }

Write-Host "`nChecking Git identity..."
$name = git config user.name
$email = git config user.email
if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($email)) {
    Write-Host "Git name/email is not configured. Nothing has been committed." -ForegroundColor Yellow
    Write-Host "Set them with:"
    Write-Host '  git config --global user.name "Your Name"'
    Write-Host '  git config --global user.email "you@example.com"'
    exit 2
}

git commit -m "chore: checkpoint v0.1.0 A01-A03 foundation"
if ($LASTEXITCODE -ne 0) { throw "git commit failed." }

Write-Host "`nCheckpoint commit created. No push was performed." -ForegroundColor Green
git status --short --branch
Write-Host "`nConfigured remotes (shown for information only):"
git remote -v
