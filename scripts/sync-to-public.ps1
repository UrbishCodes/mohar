<#
.SYNOPSIS
    Guardrail sync: copies finished code from this private build repo
    into your local clone of the PUBLIC repo (UrbishCodes/mohar).

.DESCRIPTION
    Excludes everything that must never appear in public:
      - plan/design docs (PRD.md, ARCHITECTURE.md, PRODUCT.md, DESIGN.md,
        RULES.md, TASKS.md, MEMORY.md, DECISIONS.md)
      - build artifacts, dependencies, secrets, editor files
    The public repo's .gitignore also blocks the plan docs as a backstop.

.EXAMPLE
    .\scripts\sync-to-public.ps1 -PublicRepoPath "C:\Users\Urbish\Desktop\Web3 project\mohar"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$PublicRepoPath
)

$ErrorActionPreference = "Stop"

$source = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path $PublicRepoPath)) {
    throw "Public repo path not found: $PublicRepoPath"
}
if ((Resolve-Path $source).Path -eq (Resolve-Path $PublicRepoPath).Path) {
    throw "Source and destination are the same folder. Aborting."
}

$planDocs = @(
    "PRD.md", "ARCHITECTURE.md", "PRODUCT.md", "DESIGN.md",
    "RULES.md", "TASKS.md", "MEMORY.md", "DECISIONS.md"
)

$excludeDirs = @(
    ".git", "node_modules", "target", "dist", ".anchor",
    "test-ledger", "logs", ".vscode", ".idea"
)

$excludeFiles = $planDocs + @(".env", ".env.local", "*.swp", "*.swo", ".DS_Store")

Write-Host "Syncing build -> public (plan docs excluded)..." -ForegroundColor Cyan

& robocopy $source $PublicRepoPath /E /XD @excludeDirs /XF @excludeFiles /NFL /NDL /NJH /NJS | Out-Null

# robocopy exit codes 0-7 mean success (1 = files copied, etc.)
if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Guardrail check:" -ForegroundColor Green
$leaked = Get-ChildItem -Path $PublicRepoPath -Include $planDocs -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\\.' }
if ($leaked) {
    Write-Host "  WARNING: plan docs found in public copy:" -ForegroundColor Red
    $leaked | ForEach-Object { Write-Host "    $($_.FullName)" -ForegroundColor Red }
} else {
    Write-Host "  No plan docs in public copy. Clean." -ForegroundColor Green
}

Write-Host ""
Write-Host "Next: cd into the public repo, review with 'git status', then commit + push." -ForegroundColor Yellow
