// ABOUTME: Error reference code system for user support and troubleshooting
// ABOUTME: Provides structured error codes with user-friendly messages and support guidance

import { BaseError } from './base-error';
import { ErrorCode } from './error-codes';

export interface ErrorReference {
  code: string;
  title: string;
  userMessage: string;
  suggestedActions: string[];
  supportInfo: {
    contactSupport: boolean;
    escalationLevel: 'low' | 'medium' | 'high' | 'urgent';
    knowledgeBaseUrl?: string;
    troubleshootingSteps?: string[];
  };
  technicalInfo?: {
    category: string;
    component: string;
    potentialCauses: string[];
  };
}

/**
 * Comprehensive error reference database
 */
const ERROR_REFERENCES: Record<string, ErrorReference> = {
  // Authentication Errors (AUTH-001 to AUTH-099)
  'AUTH-001': {
    code: 'AUTH-001',
    title: 'Authentication Failed',
    userMessage: 'We couldn\'t verify your identity. Please check your credentials and try again.',
    suggestedActions: [
      'Verify your username and password are correct',
      'Check if Caps Lock is enabled',
      'Try clearing your browser cache and cookies',
      'Contact your administrator if you continue to have issues'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'medium',
      troubleshootingSteps: [
        'Clear browser cache and cookies',
        'Try incognito/private browsing mode',
        'Disable browser extensions temporarily',
        'Check network connectivity'
      ]
    },
    technicalInfo: {
      category: 'Authentication',
      component: 'Azure AD Integration',
      potentialCauses: [
        'Invalid credentials',
        'Expired session',
        'Network connectivity issues',
        'Azure AD service unavailable'
      ]
    }
  },

  'AUTH-002': {
    code: 'AUTH-002',
    title: 'Session Expired',
    userMessage: 'Your session has expired. Please sign in again to continue.',
    suggestedActions: [
      'Sign in again with your credentials',
      'Enable "Remember me" for longer sessions'
    ],
    supportInfo: {
      contactSupport: false,
      escalationLevel: 'low'
    },
    technicalInfo: {
      category: 'Authentication',
      component: 'Session Management',
      potentialCauses: [
        'Session timeout reached',
        'Token expiration',
        'Server restart'
      ]
    }
  },

  'AUTH-003': {
    code: 'AUTH-003',
    title: 'Access Denied',
    userMessage: 'You don\'t have permission to access this resource.',
    suggestedActions: [
      'Contact your administrator to request access',
      'Verify you\'re signed in with the correct account',
      'Check if your account has the required permissions'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'medium'
    },
    technicalInfo: {
      category: 'Authorization',
      component: 'Permission System',
      potentialCauses: [
        'Insufficient permissions',
        'Role not assigned',
        'Resource access restricted'
      ]
    }
  },

  // Chat Errors (CHAT-001 to CHAT-099)
  'CHAT-001': {
    code: 'CHAT-001',
    title: 'Message Sending Failed',
    userMessage: 'We couldn\'t send your message. Please try again.',
    suggestedActions: [
      'Check your internet connection',
      'Try sending the message again',
      'Refresh the page if the problem persists'
    ],
    supportInfo: {
      contactSupport: false,
      escalationLevel: 'low',
      troubleshootingSteps: [
        'Check network connectivity',
        'Retry the operation',
        'Refresh the browser'
      ]
    },
    technicalInfo: {
      category: 'Chat',
      component: 'Message Service',
      potentialCauses: [
        'Network timeout',
        'Server overload',
        'Database connection issues'
      ]
    }
  },

  'CHAT-002': {
    code: 'CHAT-002',
    title: 'AI Service Unavailable',
    userMessage: 'The AI service is temporarily unavailable. Please try again in a few moments.',
    suggestedActions: [
      'Wait a few minutes and try again',
      'Check the service status page',
      'Contact support if the issue persists'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'high',
      knowledgeBaseUrl: '/help/ai-service-status'
    },
    technicalInfo: {
      category: 'AI',
      component: 'Azure OpenAI Service',
      potentialCauses: [
        'Azure OpenAI service outage',
        'Rate limits exceeded',
        'API key issues',
        'Service configuration problems'
      ]
    }
  },

  'CHAT-003': {
    code: 'CHAT-003',
    title: 'Content Filtered',
    userMessage: 'Your message contains content that cannot be processed. Please modify your message and try again.',
    suggestedActions: [
      'Remove or rephrase potentially sensitive content',
      'Avoid including personal information',
      'Try a different way of asking your question'
    ],
    supportInfo: {
      contactSupport: false,
      escalationLevel: 'low',
      knowledgeBaseUrl: '/help/content-policy'
    },
    technicalInfo: {
      category: 'Content Safety',
      component: 'Content Filter',
      potentialCauses: [
        'Azure OpenAI content filter triggered',
        'Sensitive content detected',
        'Policy violation'
      ]
    }
  },

  'CHAT-004': {
    code: 'CHAT-004',
    title: 'Message Too Long',
    userMessage: 'Your message is too long. Please shorten it and try again.',
    suggestedActions: [
      'Break your message into smaller parts',
      'Remove unnecessary details',
      'Focus on the main question or topic'
    ],
    supportInfo: {
      contactSupport: false,
      escalationLevel: 'low'
    },
    technicalInfo: {
      category: 'Validation',
      component: 'Message Validation',
      potentialCauses: [
        'Token limit exceeded',
        'Message length validation failed'
      ]
    }
  },

  // File Errors (FILE-001 to FILE-099)
  'FILE-001': {
    code: 'FILE-001',
    title: 'File Upload Failed',
    userMessage: 'We couldn\'t upload your file. Please check the file and try again.',
    suggestedActions: [
      'Check that the file size is under the limit',
      'Verify the file type is supported',
      'Try uploading a different file',
      'Check your internet connection'
    ],
    supportInfo: {
      contactSupport: false,
      escalationLevel: 'low',
      troubleshootingSteps: [
        'Verify file size and type',
        'Check network stability',
        'Try a different file format'
      ]
    },
    technicalInfo: {
      category: 'File Management',
      component: 'Azure Storage',
      potentialCauses: [
        'File size too large',
        'Unsupported file type',
        'Storage quota exceeded',
        'Network interruption'
      ]
    }
  },

  'FILE-002': {
    code: 'FILE-002',
    title: 'File Processing Failed',
    userMessage: 'We couldn\'t process your file. The file may be corrupted or in an unsupported format.',
    suggestedActions: [
      'Try uploading the file again',
      'Convert the file to a supported format',
      'Check if the file is corrupted',
      'Contact support if you continue to have issues'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'medium',
      knowledgeBaseUrl: '/help/supported-file-types'
    },
    technicalInfo: {
      category: 'File Processing',
      component: 'Document Intelligence',
      potentialCauses: [
        'Corrupted file',
        'Unsupported format',
        'Document Intelligence service error',
        'File content extraction failed'
      ]
    }
  },

  // System Errors (SYS-001 to SYS-099)
  'SYS-001': {
    code: 'SYS-001',
    title: 'System Temporarily Unavailable',
    userMessage: 'The system is temporarily unavailable. Please try again in a few minutes.',
    suggestedActions: [
      'Wait a few minutes and try again',
      'Check our status page for updates',
      'Contact support if the issue persists'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'high',
      knowledgeBaseUrl: '/status'
    },
    technicalInfo: {
      category: 'System',
      component: 'Application Infrastructure',
      potentialCauses: [
        'Server maintenance',
        'Database connectivity issues',
        'High system load',
        'Azure service outage'
      ]
    }
  },

  'SYS-002': {
    code: 'SYS-002',
    title: 'Database Connection Error',
    userMessage: 'We\'re experiencing database connectivity issues. Your data is safe, please try again shortly.',
    suggestedActions: [
      'Try refreshing the page',
      'Wait a few minutes and try again',
      'Contact support if the issue persists'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'high'
    },
    technicalInfo: {
      category: 'Database',
      component: 'Cosmos DB',
      potentialCauses: [
        'Cosmos DB connection timeout',
        'Network connectivity issues',
        'Database maintenance',
        'Quota exceeded'
      ]
    }
  },

  // Network Errors (NET-001 to NET-099)
  'NET-001': {
    code: 'NET-001',
    title: 'Network Connection Lost',
    userMessage: 'Your internet connection was lost. Please check your connection and try again.',
    suggestedActions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Switch to a different network if available',
      'Contact your network administrator'
    ],
    supportInfo: {
      contactSupport: false,
      escalationLevel: 'low'
    },
    technicalInfo: {
      category: 'Network',
      component: 'Client Connectivity',
      potentialCauses: [
        'Internet connection lost',
        'DNS resolution issues',
        'Firewall blocking',
        'Proxy configuration issues'
      ]
    }
  },

  'NET-002': {
    code: 'NET-002',
    title: 'Request Timeout',
    userMessage: 'The request took too long to complete. Please try again.',
    suggestedActions: [
      'Try the action again',
      'Check your internet connection speed',
      'Wait a moment before retrying',
      'Contact support if timeouts persist'
    ],
    supportInfo: {
      contactSupport: true,
      escalationLevel: 'medium'
    },
    technicalInfo: {
      category: 'Network',
      component: 'Request Processing',
      potentialCauses: [
        'Slow network connection',
        'Server overload',
        'Large data transfer',
        'Service timeout configuration'
      ]
    }
  }
};

/**
 * Error reference service for generating user-friendly error information
 */
export class ErrorReferenceService {
  /**
   * Get error reference information from error code
   */
  public static getReference(errorCode: ErrorCode): ErrorReference | null {
    return ERROR_REFERENCES[errorCode] || null;
  }

  /**
   * Get error reference information from BaseError
   */
  public static getReferenceFromError(error: BaseError): ErrorReference | null {
    return this.getReference(error.code);
  }

  /**
   * Generate user-friendly error message with reference code
   */
  public static generateUserMessage(error: BaseError): {
    referenceCode: string;
    title: string;
    message: string;
    actions: string[];
    supportUrl?: string;
  } {
    const reference = this.getReferenceFromError(error);
    
    if (reference) {
      return {
        referenceCode: reference.code,
        title: reference.title,
        message: reference.userMessage,
        actions: reference.suggestedActions,
        supportUrl: reference.supportInfo.knowledgeBaseUrl,
      };
    }

    // Fallback for unmapped errors
    return {
      referenceCode: error.code,
      title: 'An Error Occurred',
      message: 'Something went wrong. Please try again or contact support.',
      actions: [
        'Try the action again',
        'Refresh the page',
        'Contact support with reference code: ' + error.code
      ],
    };
  }

  /**
   * Check if error should trigger support contact
   */
  public static shouldContactSupport(errorCode: ErrorCode): boolean {
    const reference = this.getReference(errorCode);
    return reference?.supportInfo.contactSupport || false;
  }

  /**
   * Get escalation level for error
   */
  public static getEscalationLevel(errorCode: ErrorCode): 'low' | 'medium' | 'high' | 'urgent' {
    const reference = this.getReference(errorCode);
    return reference?.supportInfo.escalationLevel || 'medium';
  }

  /**
   * Get troubleshooting steps for error
   */
  public static getTroubleshootingSteps(errorCode: ErrorCode): string[] {
    const reference = this.getReference(errorCode);
    return reference?.supportInfo.troubleshootingSteps || [];
  }

  /**
   * Generate support ticket information
   */
  public static generateSupportTicket(error: BaseError, userContext?: any): {
    referenceCode: string;
    title: string;
    description: string;
    escalationLevel: string;
    technicalDetails: any;
  } {
    const reference = this.getReferenceFromError(error);
    
    return {
      referenceCode: error.code,
      title: reference?.title || 'Error Report',
      description: `User experienced error: ${reference?.userMessage || error.message}`,
      escalationLevel: reference?.supportInfo.escalationLevel || 'medium',
      technicalDetails: {
        errorCode: error.code,
        message: error.message,
        timestamp: error.timestamp,
        correlationId: error.correlationId,
        context: error.context,
        userContext,
        technicalInfo: reference?.technicalInfo,
      }
    };
  }

  /**
   * Get all available error references
   */
  public static getAllReferences(): Record<string, ErrorReference> {
    return { ...ERROR_REFERENCES };
  }

  /**
   * Search error references by category
   */
  public static getByCategory(category: string): ErrorReference[] {
    return Object.values(ERROR_REFERENCES)
      .filter(ref => ref.technicalInfo?.category === category);
  }

  /**
   * Add custom error reference
   */
  public static addReference(code: string, reference: ErrorReference): void {
    ERROR_REFERENCES[code] = reference;
  }
}