import "server-only";

import { ServerActionResponse } from "@/features/common/server-action-response";

// ABOUTME: Provides comprehensive security validation for file uploads and user inputs
// ABOUTME: Includes MIME type validation, content scanning, and XSS protection

// File Upload Security Configuration
const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': { ext: ['.pdf'], maxSize: 20 * 1024 * 1024 }, // 20MB
  'application/msword': { ext: ['.doc'], maxSize: 20 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: ['.docx'], maxSize: 20 * 1024 * 1024 },
  'text/plain': { ext: ['.txt'], maxSize: 5 * 1024 * 1024 }, // 5MB
  'text/markdown': { ext: ['.md'], maxSize: 5 * 1024 * 1024 },
  'text/csv': { ext: ['.csv'], maxSize: 10 * 1024 * 1024 },
  'application/vnd.ms-excel': { ext: ['.xls'], maxSize: 10 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: ['.xlsx'], maxSize: 10 * 1024 * 1024 }
};

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': { ext: ['.jpg', '.jpeg'], maxSize: 5 * 1024 * 1024 }, // 5MB
  'image/png': { ext: ['.png'], maxSize: 5 * 1024 * 1024 },
  'image/gif': { ext: ['.gif'], maxSize: 5 * 1024 * 1024 },
  'image/webp': { ext: ['.webp'], maxSize: 5 * 1024 * 1024 },
  'image/svg+xml': { ext: ['.svg'], maxSize: 2 * 1024 * 1024 } // 2MB - smaller for SVG due to potential exploits
};

// Magic numbers for file type verification
const FILE_SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF8
  'application/zip': [0x50, 0x4B, 0x03, 0x04], // ZIP files (including docx, xlsx)
};

interface FileValidationResult {
  isValid: boolean;
  mimeType: string;
  extension: string;
  size: number;
  errors: string[];
}

/**
 * Validates file buffer against known file signatures (magic numbers)
 */
async function validateFileSignature(buffer: ArrayBuffer, declaredMimeType: string): Promise<boolean> {
  const bytes = new Uint8Array(buffer);
  const signature = FILE_SIGNATURES[declaredMimeType as keyof typeof FILE_SIGNATURES];
  
  if (!signature) {
    // No signature check for this type, allow text files
    return declaredMimeType.startsWith('text/');
  }
  
  // Check if file starts with expected signature
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Comprehensive file validation including MIME type, extension, size, and content
 */
export async function validateFile(
  file: File,
  allowedTypes: Record<string, { ext: string[], maxSize: number }>
): Promise<ServerActionResponse<FileValidationResult>> {
  const errors: string[] = [];
  const result: FileValidationResult = {
    isValid: false,
    mimeType: file.type,
    extension: '',
    size: file.size,
    errors: []
  };

  try {
    // Extract file extension
    const lastDotIndex = file.name.lastIndexOf('.');
    const extension = lastDotIndex > 0 ? file.name.substring(lastDotIndex).toLowerCase() : '';
    result.extension = extension;

    // 1. Check MIME type
    const allowedType = allowedTypes[file.type];
    if (!allowedType) {
      errors.push(`File type '${file.type}' is not allowed`);
    }

    // 2. Check file extension
    if (allowedType && !allowedType.ext.includes(extension)) {
      errors.push(`File extension '${extension}' does not match MIME type '${file.type}'`);
    }

    // 3. Check file size
    if (allowedType && file.size > allowedType.maxSize) {
      const maxSizeMB = (allowedType.maxSize / (1024 * 1024)).toFixed(1);
      errors.push(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
    }

    // 4. Check for empty files
    if (file.size === 0) {
      errors.push('File is empty');
    }

    // 5. Validate file signature (magic numbers)
    if (errors.length === 0 && file.size > 0) {
      const buffer = await file.arrayBuffer();
      const isValidSignature = await validateFileSignature(buffer, file.type);
      
      if (!isValidSignature) {
        errors.push('File content does not match declared file type');
      }
    }

    // 6. Additional security checks for specific types
    if (file.type === 'image/svg+xml' && errors.length === 0) {
      const text = await file.text();
      // Check for potentially dangerous SVG content
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /onclick/i,
        /onload/i,
        /<iframe/i,
        /<embed/i,
        /<object/i
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(text)) {
          errors.push('SVG file contains potentially dangerous content');
          break;
        }
      }
    }

    result.errors = errors;
    result.isValid = errors.length === 0;

    if (result.isValid) {
      return {
        status: "OK",
        response: result
      };
    } else {
      return {
        status: "ERROR",
        errors: errors.map(message => ({ message }))
      };
    }
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{
        message: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

/**
 * Validate document upload
 */
export async function validateDocumentUpload(file: File): Promise<ServerActionResponse<FileValidationResult>> {
  return validateFile(file, ALLOWED_DOCUMENT_TYPES);
}

/**
 * Validate image upload
 */
export async function validateImageUpload(file: File): Promise<ServerActionResponse<FileValidationResult>> {
  return validateFile(file, ALLOWED_IMAGE_TYPES);
}

/**
 * Sanitize text input to prevent XSS attacks
 */
export function sanitizeInput(input: string, options?: {
  maxLength?: number;
  allowNewlines?: boolean;
  allowBasicFormatting?: boolean;
}): string {
  const { maxLength = 10000, allowNewlines = true, allowBasicFormatting = false } = options || {};
  
  // Handle null/undefined inputs
  if (input === null || input === undefined) {
    return '';
  }
  
  // Ensure input is a string
  let sanitized = String(input);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Basic HTML entity encoding
  if (!allowBasicFormatting) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  // Remove or replace newlines based on options
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  }
  
  // Trim to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove any remaining control characters except newlines/tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized.trim();
}

/**
 * Validate and sanitize chat message
 */
export function validateChatMessage(message: string): ServerActionResponse<string> {
  if (!message || typeof message !== 'string') {
    return {
      status: "ERROR",
      errors: [{ message: "Message is required" }]
    };
  }

  const sanitized = sanitizeInput(message, {
    maxLength: 10000,
    allowNewlines: true,
    allowBasicFormatting: false
  });

  if (sanitized.length === 0) {
    return {
      status: "ERROR", 
      errors: [{ message: "Message cannot be empty" }]
    };
  }

  return {
    status: "OK",
    response: sanitized
  };
}

/**
 * Validate chat input including content, name, thread ID, and optional image
 */
export async function validateChatInput({
  content,
  name,
  chatThreadId,
  multiModalImage
}: {
  content: string;
  name: string;
  chatThreadId: string;
  multiModalImage?: string;
}): Promise<ServerActionResponse<void>> {
  const errors: { message: string }[] = [];

  // Validate content
  const contentValidation = validateChatMessage(content);
  if (contentValidation.status !== "OK") {
    errors.push(...contentValidation.errors!);
  }

  // Validate name
  if (!name || typeof name !== 'string') {
    errors.push({ message: "Name is required" });
  } else {
    const sanitizedName = sanitizeInput(name, { maxLength: 100, allowNewlines: false });
    if (sanitizedName.length === 0) {
      errors.push({ message: "Name cannot be empty" });
    }
  }

  // Validate chat thread ID
  if (!chatThreadId || typeof chatThreadId !== 'string') {
    errors.push({ message: "Chat thread ID is required" });
  } else if (!/^[a-zA-Z0-9\-_]{1,50}$/.test(chatThreadId)) {
    errors.push({ message: "Invalid chat thread ID format" });
  }

  // Validate multimodal image if provided
  if (multiModalImage) {
    if (typeof multiModalImage !== 'string') {
      errors.push({ message: "Invalid image data format" });
    } else {
      // Basic base64 validation
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,([A-Za-z0-9+/=]+)$/;
      if (!base64Regex.test(multiModalImage)) {
        errors.push({ message: "Invalid base64 image format" });
      } else {
        // Check image size (base64 encoded)
        const base64Data = multiModalImage.split(',')[1];
        const imageSizeBytes = (base64Data.length * 3) / 4;
        if (imageSizeBytes > 5 * 1024 * 1024) { // 5MB limit
          errors.push({ message: "Image size exceeds 5MB limit" });
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      status: "ERROR",
      errors
    };
  }

  return {
    status: "OK",
    response: undefined
  };
}

/**
 * Generate cryptographically secure random string
 */
export function generateSecureSecret(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}