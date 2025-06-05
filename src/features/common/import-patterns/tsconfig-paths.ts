// ABOUTME: TypeScript path mapping configuration and standardization utilities
// ABOUTME: Provides consistent import path patterns and validation for the entire application

export interface PathMappingConfig {
  baseUrl: string;
  paths: Record<string, string[]>;
}

/**
 * Optimized path mappings for Azure Chat application
 * These patterns improve IDE performance and bundle optimization
 */
export const optimizedPathMappings: PathMappingConfig = {
  baseUrl: ".",
  paths: {
    // Core application paths
    "@/*": ["./*"],
    
    // Feature-specific paths for better organization
    "@/features/*": ["./features/*"],
    "@/app/*": ["./app/*"],
    "@/types/*": ["./types/*"],
    
    // UI component paths (most frequently imported)
    "@/ui/*": ["./features/ui/*"],
    "@/components/*": ["./features/ui/*"], // Alias for common convention
    
    // Service layer paths
    "@/services/*": ["./features/common/services/*"],
    "@/utils/*": ["./features/common/*"],
    
    // Observability and monitoring
    "@/observability/*": ["./features/common/observability/*"],
    "@/errors/*": ["./features/common/errors/*"],
    
    // Store patterns
    "@/stores/*": ["./features/*/"], // Supports store files in any feature
    "@/valtio/*": ["./features/common/valtio-patterns/*"],
    
    // Page-specific imports
    "@/chat/*": ["./features/chat-page/*"],
    "@/persona/*": ["./features/persona-page/*"],
    "@/extensions/*": ["./features/extensions-page/*"],
    "@/reporting/*": ["./features/reporting-page/*"],
    "@/prompt/*": ["./features/prompt-page/*"],
    "@/auth/*": ["./features/auth-page/*"],
    "@/menu/*": ["./features/main-menu/*"],
    
    // Test utilities
    "@/test-utils/*": ["./__tests__/utils/*"],
    "@/test/*": ["./__tests__/*"]
  }
};

/**
 * Import pattern categories for validation and optimization
 */
export const importPatterns = {
  // Preferred patterns (should be used)
  preferred: [
    "@/ui/*",           // UI components
    "@/services/*",     // Core services
    "@/utils/*",        // Utilities
    "@/features/*",     // Feature modules
    "@/observability/*", // Monitoring
    "@/errors/*",       // Error handling
    "@/types/*"         // Type definitions
  ],
  
  // Legacy patterns (should be migrated)
  legacy: [
    "@/features/ui/*",          // Should use @/ui/*
    "@/features/common/services/*", // Should use @/services/*
    "@/features/common/util*",      // Should use @/utils/*
    "@/features/common/observability/*", // Should use @/observability/*
    "@/features/common/errors/*"   // Should use @/errors/*
  ],
  
  // Discouraged patterns (should be avoided)
  discouraged: [
    "../../../*",       // Deep relative imports
    "../../*",          // Relative imports crossing feature boundaries
    "../ui/*",          // Should use absolute paths
    "./features/*"      // Missing @ prefix
  ]
};

/**
 * Rules for import standardization
 */
export const importRules = {
  // UI components should always use @/ui/* path
  ui: {
    pattern: "@/ui/*",
    examples: [
      "import { Button } from '@/ui/button';",
      "import { Dialog } from '@/ui/dialog';",
      "import { Card } from '@/ui/card';"
    ]
  },
  
  // Services should use @/services/* path
  services: {
    pattern: "@/services/*",
    examples: [
      "import { cosmos } from '@/services/cosmos';",
      "import { openai } from '@/services/openai';",
      "import { validation } from '@/services/validation-service';"
    ]
  },
  
  // Utilities should use @/utils/* path
  utils: {
    pattern: "@/utils/*",
    examples: [
      "import { uniqueId } from '@/utils/util';",
      "import { navigation } from '@/utils/navigation-helpers';"
    ]
  },
  
  // Feature-specific stores should use feature path + store name
  stores: {
    pattern: "@/chat/chat-store | @/persona/persona-store",
    examples: [
      "import { chatStore } from '@/chat/chat-store';",
      "import { menuStore } from '@/menu/menu-store';"
    ]
  },
  
  // Observability should use @/observability/*
  observability: {
    pattern: "@/observability/*",
    examples: [
      "import { logger } from '@/observability/logger';",
      "import { performance } from '@/observability/performance-monitor';"
    ]
  }
};

/**
 * Barrel export configurations for common import paths
 */
export const barrelExports = {
  // UI components barrel export
  ui: {
    path: "./features/ui/index.ts",
    exports: [
      "export { Button } from './button';",
      "export { Card } from './card';",
      "export { Dialog } from './dialog';",
      "export { Input } from './input';",
      "export { Label } from './label';",
      "export { Textarea } from './textarea';",
      "export { Badge } from './badge';",
      "export { Avatar } from './avatar';",
      "export { Alert } from './alert';",
      "export { Tabs } from './tabs';",
      "export { Sheet } from './sheet';",
      "export { ScrollArea } from './scroll-area';",
      "export { Switch } from './switch';",
      "export { Select } from './select';",
      "export { DropdownMenu } from './dropdown-menu';",
      "export { ContextMenu } from './context-menu';",
      "export { Tooltip } from './tooltip';",
      "export { Toast, Toaster } from './toast';",
      "export { useToast } from './use-toast';"
    ]
  },
  
  // Services barrel export
  services: {
    path: "./features/common/services/index.ts",
    exports: [
      "export { CosmosInstance, HistoryContainer, ConfigContainer, CosmosOperations } from './cosmos';",
      "export { OptimizedCosmosOperations } from './cosmos-enhanced';",
      "export { validateChatInput, sanitizeInput } from './validation-service';",
      "export { OpenAI } from './openai';",
      "export { AzureSearchService } from './ai-search';",
      "export { DocumentIntelligence } from './document-intelligence';",
      "export { AzureKeyVault } from './key-vault';",
      "export { AzureStorageService } from './azure-storage';"
    ]
  },
  
  // Utilities barrel export
  utils: {
    path: "./features/common/index.ts",
    exports: [
      "export { uniqueId, formatDate, cn } from './util';",
      "export { RevalidateCache, RedirectToChatThread } from './navigation-helpers';",
      "export { ServerActionResponse } from './server-action-response';",
      "export { validateSchema } from './schema-validation';"
    ]
  },
  
  // Observability barrel export
  observability: {
    path: "./features/common/observability/index.ts",
    exports: [
      "export { logger } from './logger';",
      "export { performanceMonitor } from './performance-monitor';",
      "export { appInsights } from './app-insights';",
      "export { securityAudit } from './security-audit';",
      "export { healthService } from './health-service';",
      "export { createRequestContext, addCorrelationHeaders } from './correlation-middleware';",
      "export { useNetworkStatus } from './offline-detection';"
    ]
  },
  
  // Errors barrel export
  errors: {
    path: "./features/common/errors/index.ts",
    exports: [
      "export { BaseError, ValidationError, ServiceError } from './base-error';",
      "export { ErrorCodes } from './error-codes';",
      "export { ErrorReferenceService } from './error-reference';",
      "export { serializeError } from './error-serializer';",
      "export { isRetryableError, createServiceError } from './error-utils';"
    ]
  }
};

/**
 * Migration mapping from old paths to new optimized paths
 */
export const migrationMappings: Record<string, string> = {
  // UI component migrations
  "@/features/ui/button": "@/ui/button",
  "@/features/ui/card": "@/ui/card",
  "@/features/ui/dialog": "@/ui/dialog",
  "@/features/ui/input": "@/ui/input",
  "@/features/ui/label": "@/ui/label",
  "@/features/ui/textarea": "@/ui/textarea",
  "@/features/ui/badge": "@/ui/badge",
  "@/features/ui/avatar": "@/ui/avatar",
  "@/features/ui/alert": "@/ui/alert",
  "@/features/ui/tabs": "@/ui/tabs",
  "@/features/ui/sheet": "@/ui/sheet",
  "@/features/ui/scroll-area": "@/ui/scroll-area",
  "@/features/ui/switch": "@/ui/switch",
  "@/features/ui/select": "@/ui/select",
  "@/features/ui/dropdown-menu": "@/ui/dropdown-menu",
  "@/features/ui/context-menu": "@/ui/context-menu",
  "@/features/ui/tooltip": "@/ui/tooltip",
  "@/features/ui/toast": "@/ui/toast",
  "@/features/ui/toaster": "@/ui/toaster",
  "@/features/ui/use-toast": "@/ui/use-toast",
  
  // Services migrations
  "@/features/common/services/cosmos": "@/services/cosmos",
  "@/features/common/services/cosmos-enhanced": "@/services/cosmos-enhanced",
  "@/features/common/services/validation-service": "@/services/validation-service",
  "@/features/common/services/openai": "@/services/openai",
  "@/features/common/services/ai-search": "@/services/ai-search",
  "@/features/common/services/document-intelligence": "@/services/document-intelligence",
  "@/features/common/services/key-vault": "@/services/key-vault",
  "@/features/common/services/azure-storage": "@/services/azure-storage",
  
  // Utilities migrations
  "@/features/common/util": "@/utils/util",
  "@/features/common/navigation-helpers": "@/utils/navigation-helpers",
  "@/features/common/server-action-response": "@/utils/server-action-response",
  "@/features/common/schema-validation": "@/utils/schema-validation",
  
  // Observability migrations
  "@/features/common/observability/logger": "@/observability/logger",
  "@/features/common/observability/performance-monitor": "@/observability/performance-monitor",
  "@/features/common/observability/app-insights": "@/observability/app-insights",
  "@/features/common/observability/security-audit": "@/observability/security-audit",
  "@/features/common/observability/health-service": "@/observability/health-service",
  "@/features/common/observability/correlation-middleware": "@/observability/correlation-middleware",
  "@/features/common/observability/offline-detection": "@/observability/offline-detection",
  
  // Errors migrations
  "@/features/common/errors/base-error": "@/errors/base-error",
  "@/features/common/errors/error-codes": "@/errors/error-codes",
  "@/features/common/errors/error-reference": "@/errors/error-reference",
  "@/features/common/errors/error-serializer": "@/errors/error-serializer",
  "@/features/common/errors/error-utils": "@/errors/error-utils"
};

/**
 * Validation function to check import patterns
 */
export function validateImportPath(importPath: string): {
  isValid: boolean;
  category: 'preferred' | 'legacy' | 'discouraged';
  suggestion?: string;
} {
  // Check if it's a preferred pattern
  if (importPatterns.preferred.some(pattern => 
    importPath.match(pattern.replace('*', '.*')))) {
    return { isValid: true, category: 'preferred' };
  }
  
  // Check if it's a legacy pattern
  const legacyMatch = importPatterns.legacy.find(pattern => 
    importPath.match(pattern.replace('*', '.*')));
  if (legacyMatch) {
    const suggestion = migrationMappings[importPath] || 
      importPath.replace(legacyMatch.replace('*', ''), 
        importPatterns.preferred.find(p => p.includes(legacyMatch.split('/')[1]))?.replace('*', '') || '');
    return { 
      isValid: false, 
      category: 'legacy', 
      suggestion 
    };
  }
  
  // Check if it's a discouraged pattern
  if (importPatterns.discouraged.some(pattern => 
    importPath.match(pattern.replace('*', '.*')))) {
    return { isValid: false, category: 'discouraged' };
  }
  
  // Default to valid if not caught by rules
  return { isValid: true, category: 'preferred' };
}