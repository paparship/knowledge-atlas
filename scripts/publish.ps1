$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  node scripts/build-pages.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
  git add -- public scripts tests docs workspace/inbox workspace/confirmed workspace/graph.json workspace/assets .gitignore package.json README.md server.mjs start.cmd
  if ($LASTEXITCODE -ne 0) { throw 'Staging failed' }
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 1) {
    git commit -m 'Update knowledge atlas'
    if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
  }
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
} finally { Pop-Location }
