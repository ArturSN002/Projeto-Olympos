<#
.SYNOPSIS
    Deploy automatizado do Hub Olympos WebApp (Google Apps Script) via CLI `clasp`.
    Onda 12 — Infraestrutura, Automação & IA Resiliente (SMEB Ceará-Mirim/RN).
#>
[CmdletBinding()]
param(
    [string]$ScriptId = "1UKHhvJeroRWHRTTpaDJxVPZWUDAZ7SEwQVMDwG3QBBWexBtPpOOhbBAR",
    [string]$DeploymentId = "AKfycbyzR5XXXk6nElGdpEsuOAlPCjdA3KR3KH-IF5SAfFcCC9DJ6iFs714wXb6A5liFGAbQcg",
    [string]$Description = "Hub Olympos WebApp Deploy Automatizado (clasp)",
    [switch]$SkipPing
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$HubDir = Join-Path $RepoRoot "1_google_apps_script\hub_webapp"
if (-not (Test-Path $HubDir)) {
    $HubDir = Join-Path $RepoRoot "hub-olympos-webapp"
}
if (-not (Test-Path $HubDir)) {
    throw "Diretório do Google Apps Script não encontrado em '$RepoRoot'."
}

$ClaspCmd = Get-Command clasp -ErrorAction SilentlyContinue
if (-not $ClaspCmd) {
    throw "CLI 'clasp' não encontrado no PATH. Execute: npm install -g @google/clasp"
}

$StageDir = Join-Path ([System.IO.Path]::GetTempPath()) ("olympos-clasp-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

try {
    Get-ChildItem -Path $HubDir -File | Where-Object {
        $_.Extension -in @(".gs", ".js", ".html") -or $_.Name -eq "appsscript.json"
    } | ForEach-Object {
        $targetName = $_.Name
        # Preserva exatamente o mapeamento remoto no projeto Apps Script
        if ($targetName -eq "04_module_prometheus.gs") {
            $targetName = "04_modules_prometheus.js"
        } elseif ($_.Extension -eq ".gs") {
            $targetName = [System.IO.Path]::ChangeExtension($targetName, ".js")
        }
        Copy-Item -Path $_.FullName -Destination (Join-Path $StageDir $targetName) -Force
    }

    $claspCfg = @{
        scriptId = $ScriptId
        rootDir  = "."
    } | ConvertTo-Json -Depth 3
    Set-Content -Path (Join-Path $StageDir ".clasp.json") -Value $claspCfg -Encoding UTF8

    Push-Location $StageDir
    try {
        Write-Host "[CLASP] Enviando arquivos de '$HubDir' para Script '$ScriptId'..."
        & clasp push -f
        if ($LASTEXITCODE -ne 0) {
            throw "Falha no 'clasp push -f' (exit $LASTEXITCODE)."
        }

        Write-Host "[CLASP] Publicando Deployment '$DeploymentId'..."
        & clasp deploy -i $DeploymentId -d $Description
        if ($LASTEXITCODE -ne 0) {
            throw "Falha no 'clasp deploy' (exit $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
    }

    if (-not $SkipPing) {
        $webAppUrl = "https://script.google.com/macros/s/$DeploymentId/exec?action=ping"
        Write-Host "[CLASP] Validando endpoint GET $webAppUrl ..."
        $pingResp = Invoke-RestMethod -Uri $webAppUrl -Method Get -TimeoutSec 25
        if (-not $pingResp.ok) {
            throw "Endpoint GAS respondeu sem ok=true."
        }
        Write-Host "[CLASP OK] $($pingResp | ConvertTo-Json -Compress)"
    }
} finally {
    if (Test-Path $StageDir) {
        Remove-Item -Path $StageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
