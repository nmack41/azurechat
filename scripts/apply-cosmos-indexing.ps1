# ABOUTME: PowerShell script to apply optimized indexing policy to Azure Cosmos DB containers
# ABOUTME: Updates both history and config containers with performance-optimized composite indexes

param(
    [string]$AccountName = $env:AZURE_COSMOSDB_ACCOUNT_NAME,
    [string]$ResourceGroup = $env:AZURE_COSMOSDB_RESOURCE_GROUP,
    [string]$DatabaseName = $env:AZURE_COSMOSDB_DB_NAME,
    [string]$HistoryContainer = $env:AZURE_COSMOSDB_CONTAINER_NAME,
    [string]$ConfigContainer = $env:AZURE_COSMOSDB_CONFIG_CONTAINER_NAME
)

# Set defaults
if (-not $DatabaseName) { $DatabaseName = "chat" }
if (-not $HistoryContainer) { $HistoryContainer = "history" }
if (-not $ConfigContainer) { $ConfigContainer = "config" }

Write-Host "Azure Chat - Cosmos DB Indexing Optimization" -ForegroundColor Green
Write-Host "============================================="

# Check required parameters
if (-not $AccountName) {
    Write-Host "Error: AZURE_COSMOSDB_ACCOUNT_NAME not set" -ForegroundColor Red
    Write-Host "Please set the environment variable or pass -AccountName parameter"
    exit 1
}

if (-not $ResourceGroup) {
    Write-Host "Error: AZURE_COSMOSDB_RESOURCE_GROUP not set" -ForegroundColor Red
    Write-Host "Please set the environment variable or pass -ResourceGroup parameter"
    exit 1
}

Write-Host "Configuration:"
Write-Host "- Account Name: $AccountName"
Write-Host "- Resource Group: $ResourceGroup"
Write-Host "- Database Name: $DatabaseName"
Write-Host "- History Container: $HistoryContainer"
Write-Host "- Config Container: $ConfigContainer"
Write-Host ""

# Check if Azure CLI is available
try {
    $azVersion = az --version 2>$null
    if (-not $azVersion) {
        throw "Azure CLI not found"
    }
} catch {
    Write-Host "Error: Azure CLI is not installed" -ForegroundColor Red
    Write-Host "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
}

# Check if logged in
try {
    $account = az account show 2>$null | ConvertFrom-Json
    if (-not $account) {
        throw "Not logged in"
    }
} catch {
    Write-Host "Error: Not logged in to Azure" -ForegroundColor Red
    Write-Host "Please run: az login"
    exit 1
}

Write-Host "Step 1: Checking if Cosmos DB account exists..." -ForegroundColor Yellow
try {
    $cosmosAccount = az cosmosdb show --name $AccountName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if (-not $cosmosAccount) {
        throw "Account not found"
    }
    Write-Host "✓ Cosmos DB account found" -ForegroundColor Green
} catch {
    Write-Host "Error: Cosmos DB account '$AccountName' not found in resource group '$ResourceGroup'" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Checking if database exists..." -ForegroundColor Yellow
try {
    $database = az cosmosdb sql database show --account-name $AccountName --resource-group $ResourceGroup --name $DatabaseName 2>$null | ConvertFrom-Json
    if (-not $database) {
        throw "Database not found"
    }
    Write-Host "✓ Database found" -ForegroundColor Green
} catch {
    Write-Host "Error: Database '$DatabaseName' not found" -ForegroundColor Red
    exit 1
}

Write-Host "Step 3: Checking if history container exists..." -ForegroundColor Yellow
try {
    $historyContainer = az cosmosdb sql container show --account-name $AccountName --resource-group $ResourceGroup --database-name $DatabaseName --name $HistoryContainer 2>$null | ConvertFrom-Json
    if (-not $historyContainer) {
        throw "Container not found"
    }
    Write-Host "✓ History container found" -ForegroundColor Green
} catch {
    Write-Host "Error: History container '$HistoryContainer' not found" -ForegroundColor Red
    exit 1
}

Write-Host "Step 4: Backing up current indexing policy..." -ForegroundColor Yellow
$backupDir = "./cosmos-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$currentPolicy = az cosmosdb sql container show `
    --account-name $AccountName `
    --resource-group $ResourceGroup `
    --database-name $DatabaseName `
    --name $HistoryContainer `
    --query "resource.indexingPolicy" 2>$null

$currentPolicy | Out-File -FilePath "$backupDir/history-indexing-policy-backup.json" -Encoding UTF8

Write-Host "✓ Current indexing policy backed up to $backupDir/history-indexing-policy-backup.json" -ForegroundColor Green

Write-Host "Step 5: Applying optimized indexing policy to history container..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $PSCommandPath
$indexingPolicyFile = Join-Path $scriptDir "../src/features/common/services/cosmos-indexing-policy.json"

if (-not (Test-Path $indexingPolicyFile)) {
    Write-Host "Error: Indexing policy file not found at $indexingPolicyFile" -ForegroundColor Red
    exit 1
}

Write-Host "Applying indexing policy from: $indexingPolicyFile"

try {
    az cosmosdb sql container update `
        --account-name $AccountName `
        --resource-group $ResourceGroup `
        --database-name $DatabaseName `
        --name $HistoryContainer `
        --idx "@$indexingPolicyFile" 2>$null

    Write-Host "✓ Indexing policy applied to history container" -ForegroundColor Green
} catch {
    Write-Host "Error applying indexing policy: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Step 6: Verifying indexing policy update..." -ForegroundColor Yellow
$newPolicy = az cosmosdb sql container show `
    --account-name $AccountName `
    --resource-group $ResourceGroup `
    --database-name $DatabaseName `
    --name $HistoryContainer `
    --query "resource.indexingPolicy.compositeIndexes[0]" -o json 2>$null

if ($newPolicy -and $newPolicy -ne "null" -and $newPolicy -ne "[]") {
    Write-Host "✓ Composite indexes successfully applied" -ForegroundColor Green
} else {
    Write-Host "Warning: Composite indexes may not have been applied correctly" -ForegroundColor Red
}

Write-Host "Step 7: Checking config container..." -ForegroundColor Yellow
try {
    $configContainer = az cosmosdb sql container show --account-name $AccountName --resource-group $ResourceGroup --database-name $DatabaseName --name $ConfigContainer 2>$null | ConvertFrom-Json
    if ($configContainer) {
        Write-Host "Applying indexing policy to config container..."
        az cosmosdb sql container update `
            --account-name $AccountName `
            --resource-group $ResourceGroup `
            --database-name $DatabaseName `
            --name $ConfigContainer `
            --idx "@$indexingPolicyFile" 2>$null
        Write-Host "✓ Indexing policy applied to config container" -ForegroundColor Green
    } else {
        Write-Host "Config container not found, skipping..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Config container not found, skipping..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Indexing optimization completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Monitor query performance in Azure portal"
Write-Host "2. Check RU consumption patterns"
Write-Host "3. Verify composite index usage with query explain plans"
Write-Host ""
Write-Host "Backup location: $backupDir"
Write-Host ""
Write-Host "Note: Index transformation may take several minutes to complete in the background." -ForegroundColor Yellow