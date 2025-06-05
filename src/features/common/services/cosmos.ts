import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { performanceMonitor } from "@/observability/performance-monitor";
import { OptimizedCosmosOperations } from "./cosmos-enhanced";

// Configure Cosmos DB details
const DB_NAME = process.env.AZURE_COSMOSDB_DB_NAME || "chat";
const CONTAINER_NAME = process.env.AZURE_COSMOSDB_CONTAINER_NAME || "history";
const CONFIG_CONTAINER_NAME = process.env.AZURE_COSMOSDB_CONFIG_CONTAINER_NAME || "config";
const USE_MANAGED_IDENTITIES = process.env.USE_MANAGED_IDENTITIES === "true";

const getCosmosCredential = () => {
  if (USE_MANAGED_IDENTITIES) {
    return new DefaultAzureCredential();
  }
  const key = process.env.AZURE_COSMOSDB_KEY;
  if (!key) {
    throw new Error("Azure Cosmos DB key is not provided in environment variables.");
  }
  return key;
};

export const CosmosInstance = () => {
  const endpoint = process.env.AZURE_COSMOSDB_URI;

  if (!endpoint) {
    throw new Error(
      "Azure Cosmos DB endpoint is not configured. Please configure it in the .env file."
    );
  }

  const credential = getCosmosCredential();
  if (credential instanceof DefaultAzureCredential) {
    return new CosmosClient({ endpoint, aadCredentials: credential });
  } else {
    return new CosmosClient({ endpoint, key: credential });
  }
};

export const ConfigContainer = () => {
  const client = CosmosInstance();
  const database = client.database(DB_NAME);
  const container = database.container(CONFIG_CONTAINER_NAME);
  return container;
};

export const HistoryContainer = () => {
  const client = CosmosInstance();
  const database = client.database(DB_NAME);
  const container = database.container(CONTAINER_NAME);
  return container;
};

// Enhanced cosmos operations with performance monitoring (legacy compatibility)
export const CosmosOperations = {
  /**
   * Monitored query operation - delegates to optimized version
   */
  async query<T>(container: any, querySpec: any, options?: any): Promise<T[]> {
    const result = await OptimizedCosmosOperations.query<T>(container, querySpec, options);
    return result.resources;
  },

  /**
   * Monitored upsert operation - delegates to optimized version
   */
  async upsert<T>(container: any, item: T): Promise<T> {
    const result = await OptimizedCosmosOperations.upsert<T>(container, item);
    return result.resource;
  },

  /**
   * Monitored read operation - delegates to optimized version
   */
  async read<T>(container: any, id: string, partitionKey?: string): Promise<T | null> {
    const result = await OptimizedCosmosOperations.read<T>(container, id, partitionKey);
    return result.resource || null;
  },

  /**
   * Monitored delete operation - delegates to optimized version
   */
  async delete(container: any, id: string, partitionKey?: string): Promise<void> {
    await OptimizedCosmosOperations.delete(container, id, partitionKey);
  },
};

// Export enhanced operations for new code
export { OptimizedCosmosOperations };
