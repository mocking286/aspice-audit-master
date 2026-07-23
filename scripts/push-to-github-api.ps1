param(
  [string]$Owner = "mocking286",
  [string]$Repo = "aspice-audit-master",
  [string]$Branch = "main",
  [string]$Source = "C:\Users\YuMeng Li\OneDrive - JE\Desktop\aspice-audit-master-refactored\github_upload_staging",
  [string]$Token = $env:GITHUB_TOKEN,
  [string]$CommitMessage = "Update aspice-audit-master app, Edge extension, and assessment documentation"
)

$ErrorActionPreference = "Stop"

if (!$Token) {
  throw "GITHUB_TOKEN is not set. Create a fine-grained GitHub token with Contents: Read and write for $Owner/$Repo, then run: `$env:GITHUB_TOKEN='***'; powershell -ExecutionPolicy Bypass -File .\push-to-github-api.ps1"
}
if (!(Test-Path -LiteralPath $Source)) {
  throw "Source folder not found: $Source"
}

$headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "aspice-audit-master-uploader"
}

function Get-GitHubFileSha([string]$Path) {
  $encoded = ($Path -split "/" | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join "/"
  $uri = "https://api.github.com/repos/$Owner/$Repo/contents/$encoded`?ref=$Branch"
  try {
    $item = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
    return [string]$item.sha
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
      return ""
    }
    throw
  }
}

$files = Get-ChildItem -LiteralPath $Source -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\\.git\\' -and
  $_.Name -notmatch '\.pem$' -and
  $_.Name -notmatch 'aspice-audit-memory\.json$'
}

$count = 0
foreach ($file in $files) {
  $relative = $file.FullName.Substring((Resolve-Path -LiteralPath $Source).Path.Length).TrimStart("\", "/") -replace '\\', '/'
  $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
  if ($bytes.Length -gt 95000000) {
    Write-Warning "Skipping $relative because it is too large for GitHub Contents API."
    continue
  }
  $body = [ordered]@{
    message = "$CommitMessage - $relative"
    content = [Convert]::ToBase64String($bytes)
    branch = $Branch
  }
  $sha = Get-GitHubFileSha $relative
  if ($sha) { $body.sha = $sha }
  $encoded = ($relative -split "/" | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join "/"
  $uri = "https://api.github.com/repos/$Owner/$Repo/contents/$encoded"
  Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10) | Out-Null
  $count++
  Write-Host "Uploaded $relative"
}

Write-Host "Uploaded $count file(s) to $Owner/$Repo@$Branch."
