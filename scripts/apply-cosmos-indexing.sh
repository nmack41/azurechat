#!/bin/bash

# ABOUTME: Script to apply optimized indexing policy to Azure Cosmos DB containers
# ABOUTME: Updates both history and config containers with performance-optimized composite indexes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Azure Chat - Cosmos DB Indexing Optimization${NC}"
echo "============================================="

# Check if required environment variables are set
if [ -z "$AZURE_COSMOSDB_ACCOUNT_NAME" ]; then
    echo -e "${RED}Error: AZURE_COSMOSDB_ACCOUNT_NAME environment variable not set${NC}"
    echo "Please set this to your Cosmos DB account name"
    exit 1
fi

if [ -z "$AZURE_COSMOSDB_RESOURCE_GROUP" ]; then
    echo -e "${RED}Error: AZURE_COSMOSDB_RESOURCE_GROUP environment variable not set${NC}"
    echo "Please set this to your resource group name"
    exit 1
fi

# Set defaults
DB_NAME=${AZURE_COSMOSDB_DB_NAME:-"chat"}
HISTORY_CONTAINER=${AZURE_COSMOSDB_CONTAINER_NAME:-"history"}
CONFIG_CONTAINER=${AZURE_COSMOSDB_CONFIG_CONTAINER_NAME:-"config"}

echo "Configuration:"
echo "- Account Name: $AZURE_COSMOSDB_ACCOUNT_NAME"
echo "- Resource Group: $AZURE_COSMOSDB_RESOURCE_GROUP"
echo "- Database Name: $DB_NAME"
echo "- History Container: $HISTORY_CONTAINER"
echo "- Config Container: $CONFIG_CONTAINER"
echo ""

# Check if Azure CLI is installed and logged in
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Please install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure${NC}"
    echo "Please run: az login"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking if Cosmos DB account exists...${NC}"
if ! az cosmosdb show --name "$AZURE_COSMOSDB_ACCOUNT_NAME" --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}Error: Cosmos DB account '$AZURE_COSMOSDB_ACCOUNT_NAME' not found in resource group '$AZURE_COSMOSDB_RESOURCE_GROUP'${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Cosmos DB account found${NC}"

echo -e "${YELLOW}Step 2: Checking if database exists...${NC}"
if ! az cosmosdb sql database show --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" --name "$DB_NAME" &> /dev/null; then
    echo -e "${RED}Error: Database '$DB_NAME' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database found${NC}"

echo -e "${YELLOW}Step 3: Checking if history container exists...${NC}"
if ! az cosmosdb sql container show --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" --database-name "$DB_NAME" --name "$HISTORY_CONTAINER" &> /dev/null; then
    echo -e "${RED}Error: History container '$HISTORY_CONTAINER' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ History container found${NC}"

echo -e "${YELLOW}Step 4: Backing up current indexing policy...${NC}"
BACKUP_DIR="./cosmos-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

az cosmosdb sql container show \
    --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" \
    --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" \
    --database-name "$DB_NAME" \
    --name "$HISTORY_CONTAINER" \
    --query "resource.indexingPolicy" > "$BACKUP_DIR/history-indexing-policy-backup.json"

echo -e "${GREEN}✓ Current indexing policy backed up to $BACKUP_DIR/history-indexing-policy-backup.json${NC}"

echo -e "${YELLOW}Step 5: Applying optimized indexing policy to history container...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDEXING_POLICY_FILE="$SCRIPT_DIR/../src/features/common/services/cosmos-indexing-policy.json"

if [ ! -f "$INDEXING_POLICY_FILE" ]; then
    echo -e "${RED}Error: Indexing policy file not found at $INDEXING_POLICY_FILE${NC}"
    exit 1
fi

echo "Applying indexing policy from: $INDEXING_POLICY_FILE"

az cosmosdb sql container update \
    --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" \
    --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" \
    --database-name "$DB_NAME" \
    --name "$HISTORY_CONTAINER" \
    --idx "@$INDEXING_POLICY_FILE"

echo -e "${GREEN}✓ Indexing policy applied to history container${NC}"

echo -e "${YELLOW}Step 6: Verifying indexing policy update...${NC}"
NEW_POLICY=$(az cosmosdb sql container show \
    --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" \
    --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" \
    --database-name "$DB_NAME" \
    --name "$HISTORY_CONTAINER" \
    --query "resource.indexingPolicy.compositeIndexes[0]" -o json)

if [ "$NEW_POLICY" != "null" ] && [ "$NEW_POLICY" != "[]" ]; then
    echo -e "${GREEN}✓ Composite indexes successfully applied${NC}"
else
    echo -e "${RED}Warning: Composite indexes may not have been applied correctly${NC}"
fi

echo -e "${YELLOW}Step 7: Checking config container...${NC}"
if az cosmosdb sql container show --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" --database-name "$DB_NAME" --name "$CONFIG_CONTAINER" &> /dev/null; then
    echo "Applying indexing policy to config container..."
    az cosmosdb sql container update \
        --account-name "$AZURE_COSMOSDB_ACCOUNT_NAME" \
        --resource-group "$AZURE_COSMOSDB_RESOURCE_GROUP" \
        --database-name "$DB_NAME" \
        --name "$CONFIG_CONTAINER" \
        --idx "@$INDEXING_POLICY_FILE"
    echo -e "${GREEN}✓ Indexing policy applied to config container${NC}"
else
    echo -e "${YELLOW}Config container not found, skipping...${NC}"
fi

echo ""
echo -e "${GREEN}Indexing optimization completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor query performance in Azure portal"
echo "2. Check RU consumption patterns"
echo "3. Verify composite index usage with query explain plans"
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}Note: Index transformation may take several minutes to complete in the background.${NC}"