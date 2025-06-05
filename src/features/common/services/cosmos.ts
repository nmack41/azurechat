import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { performanceMonitor } from "@/features/common/observability/performance-monitor";

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

// Enhanced cosmos operations with performance monitoring
export const CosmosOperations = {
  /**
   * Monitored query operation
   */
  async query<T>(container: any, querySpec: any, options?: any): Promise<T[]> {
    const measurement = performanceMonitor.startMeasurement('cosmos_query', {
      container: container.id || 'unknown',
      query: querySpec.query || 'unknown',
    });

    try {
      const { resources } = await container.items.query<T>(querySpec, options).fetchAll();
      
      measurement.finish(true, {
        resultCount: resources.length,
        cached: false,
      });
      
      return resources;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },

  /**
   * Monitored upsert operation
   */
  async upsert<T>(container: any, item: T): Promise<T> {
    const measurement = performanceMonitor.startMeasurement('cosmos_upsert', {
      container: container.id || 'unknown',
    });

    try {
      const { resource } = await container.items.upsert(item);
      
      measurement.finish(true, {
        cached: false,
      });
      
      return resource;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },

  /**
   * Monitored read operation
   */
  async read<T>(container: any, id: string, partitionKey?: string): Promise<T | null> {
    const measurement = performanceMonitor.startMeasurement('cosmos_read', {
      container: container.id || 'unknown',
      hasPartitionKey: !!partitionKey,
    });

    try {
      const { resource } = await container.item(id, partitionKey).read<T>();
      
      measurement.finish(true, {
        resultCount: resource ? 1 : 0,
        cached: false,
      });
      
      return resource || null;
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },

  /**
   * Monitored delete operation
   */
  async delete(container: any, id: string, partitionKey?: string): Promise<void> {
    const measurement = performanceMonitor.startMeasurement('cosmos_delete', {
      container: container.id || 'unknown',
      hasPartitionKey: !!partitionKey,
    });

    try {
      await container.item(id, partitionKey).delete();
      
      measurement.finish(true, {
        cached: false,
      });
    } catch (error) {
      measurement.finish(false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
};
