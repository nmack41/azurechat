// ABOUTME: Barrel export for all service modules to enable clean imports
// ABOUTME: Centralizes service exports for better tree-shaking and import organization

// Core Database Services
export { 
  CosmosInstance, 
  HistoryContainer, 
  ConfigContainer 
} from './cosmos';

export { 
  OptimizedCosmosOperations 
} from './cosmos-enhanced';

export {
  ConnectionPoolManager
} from './connection-pool-manager';

export {
  StreamingQueryService
} from './streaming-query-service';

// Azure Services
export { 
  OpenAIInstance,
  OpenAIEmbeddingInstance,
  OpenAIDALLEInstance
} from './openai';

export {
  OpenAIService
} from './openai-service';

export { 
  GetCredential,
  AzureAISearchInstance,
  AzureAISearchIndexClientInstance,
  AzureAISearchIndexerClientInstance
} from './ai-search';

export { 
  DocumentIntelligenceInstance
} from './document-intelligence';

export { 
  AzureKeyVaultInstance
} from './key-vault';

export { 
  UploadBlob,
  GetBlob
} from './azure-storage';

export {
  AzureStorageService as AzureStorageEnhanced,
  azureStorageService
} from './azure-storage-enhanced';

// Validation Services
export { 
  validateChatInput, 
  sanitizeInput,
  validateChatMessage,
  validateDocumentUpload
} from './validation-service';

// Cosmos DB Optimized Service
export {
  OptimizedCosmosService as CosmosOptimized,
  optimizedCosmosService
} from './cosmos-optimized';

export {
  CosmosService
} from './cosmos-service';

// Cached services
export {
  cachedCosmosService,
  CachedCosmosService
} from './cosmos-service-cached';

export {
  cosmosQueryCache,
  CosmosQueryCache,
  COMMON_QUERIES
} from './cosmos-cache-enhanced';