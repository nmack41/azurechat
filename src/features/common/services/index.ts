// ABOUTME: Barrel export for all service modules to enable clean imports
// ABOUTME: Centralizes service exports for better tree-shaking and import organization

// Core Database Services
export { 
  CosmosInstance, 
  HistoryContainer, 
  ConfigContainer, 
  CosmosOperations 
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
  OpenAI,
  ChatRole,
  AzureChatCompletion
} from './openai';

export {
  OpenAIService
} from './openai-service';

export { 
  AzureSearchService,
  SearchDocument,
  SearchOptions
} from './ai-search';

export { 
  DocumentIntelligence,
  DocumentAnalysisResult
} from './document-intelligence';

export { 
  AzureKeyVault,
  SecretValue
} from './key-vault';

export { 
  AzureStorageService,
  StorageUploadResult
} from './azure-storage';

export {
  AzureStorageEnhanced
} from './azure-storage-enhanced';

// Validation Services
export { 
  validateChatInput, 
  sanitizeInput,
  ValidationOptions,
  ValidationResult
} from './validation-service';

// Cosmos DB Optimized Service
export {
  CosmosOptimized
} from './cosmos-optimized';

export {
  CosmosService
} from './cosmos-service';