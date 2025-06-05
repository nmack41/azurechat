"use server";
import "server-only";

import {
  getCurrentUser,
  userHashedId,
  userSession,
} from "@/features/auth-page/helpers";
import { sanitizeInput } from "@/services/validation-service";
import { UpsertChatThread } from "@/features/chat-page/chat-services/chat-thread-service";
import {
  CHAT_THREAD_ATTRIBUTE,
  ChatThreadModel,
} from "@/features/chat-page/chat-services/models";
import {
  ServerActionResponse,
  zodErrorsToServerActionErrors,
} from "@/features/common/server-action-response";
import { HistoryContainer } from "@/services/cosmos";
import { AzureKeyVaultInstance } from "@/services/key-vault";
import { uniqueId } from "@/utils/util";
import { AI_NAME, CHAT_DEFAULT_PERSONA } from "@/features/theme/theme-config";
import { SqlQuerySpec } from "@azure/cosmos";
import {
  EXTENSION_ATTRIBUTE,
  ExtensionModel,
  ExtensionModelSchema,
} from "./models";

const KEY_VAULT_MASK = "**********";

export const FindExtensionByID = async (
  id: string
): Promise<ServerActionResponse<ExtensionModel>> => {
  try {
    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root r WHERE r.type=@type AND r.id=@id",
      parameters: [
        {
          name: "@type",
          value: EXTENSION_ATTRIBUTE,
        },
        {
          name: "@id",
          value: id,
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<ExtensionModel>(querySpec)
      .fetchAll();

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [
          {
            message: `Extension not found with id: ${id}`,
          },
        ],
      };
    }

    return {
      status: "OK",
      response: resources[0]!,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error finding Extension: ${error}`,
        },
      ],
    };
  }
};

export const CreateExtension = async (
  inputModel: ExtensionModel
): Promise<ServerActionResponse<ExtensionModel>> => {
  try {
    const user = await getCurrentUser();

    // Validate and sanitize basic extension fields
    const sanitizedName = sanitizeInput(inputModel.name, { maxLength: 100, allowNewlines: false });
    const sanitizedDescription = sanitizeInput(inputModel.description, { maxLength: 500, allowNewlines: true });
    const sanitizedExecutionSteps = sanitizeInput(inputModel.executionSteps, { maxLength: 2000, allowNewlines: true });

    if (!sanitizedName || !sanitizedDescription || !sanitizedExecutionSteps) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Extension name, description, and execution steps are required and cannot be empty.",
          },
        ],
      };
    }

    // Validate headers for security
    for (const header of inputModel.headers) {
      if (!header.key || !header.value) {
        return {
          status: "ERROR",
          errors: [
            {
              message: "All header keys and values must be provided.",
            },
          ],
        };
      }

      // Sanitize header key and value
      const sanitizedKey = sanitizeInput(header.key, { maxLength: 100, allowNewlines: false });
      const sanitizedValue = sanitizeInput(header.value, { maxLength: 1000, allowNewlines: false });

      if (!sanitizedKey || !sanitizedValue) {
        return {
          status: "ERROR",
          errors: [
            {
              message: "Header keys and values cannot be empty after sanitization.",
            },
          ],
        };
      }

      header.key = sanitizedKey;
      header.value = sanitizedValue;
      header.id = uniqueId();
    }

    // Validate functions
    for (const func of inputModel.functions) {
      if (!func.endpoint || typeof func.endpoint !== 'string') {
        return {
          status: "ERROR",
          errors: [
            {
              message: "Function endpoint is required.",
            },
          ],
        };
      }

      // Sanitize and validate endpoint URL
      const sanitizedEndpoint = sanitizeInput(func.endpoint, { maxLength: 500, allowNewlines: false });
      if (!sanitizedEndpoint) {
        return {
          status: "ERROR",
          errors: [
            {
              message: "Function endpoint cannot be empty.",
            },
          ],
        };
      }

      // Basic URL validation
      try {
        new URL(sanitizedEndpoint);
      } catch {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Invalid URL format for endpoint: ${sanitizedEndpoint}`,
            },
          ],
        };
      }

      func.endpoint = sanitizedEndpoint;
      func.id = uniqueId();
    }

    const modelToSave: ExtensionModel = {
      id: uniqueId(),
      name: sanitizedName,
      executionSteps: sanitizedExecutionSteps,
      description: sanitizedDescription,
      isPublished: user.isAdmin ? inputModel.isPublished : false,
      userId: await userHashedId(),
      createdAt: new Date(),
      type: "EXTENSION",
      functions: inputModel.functions,
      headers: inputModel.headers,
    };

    const validatedFields = validateSchema(modelToSave);

    if (validatedFields.status === "OK") {
      await secureHeaderValues(modelToSave);

      const { resource } =
        await HistoryContainer().items.create<ExtensionModel>(modelToSave);

      if (resource) {
        return {
          status: "OK",
          response: resource,
        };
      } else {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Unable to add Extension: ${resource}`,
            },
          ],
        };
      }
    } else {
      return validatedFields;
    }
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error adding Extension: ${error}`,
        },
      ],
    };
  }
};

const secureHeaderValues = async (extension: ExtensionModel) => {
  const vault = AzureKeyVaultInstance();

  const headers = extension.headers.map(async (h) => {
    if (h.value !== KEY_VAULT_MASK) {
      await vault.setSecret(h.id, h.value);
      h.value = KEY_VAULT_MASK;
    }

    return h;
  });

  await Promise.all(headers);

  return extension;
};

export const EnsureExtensionOperation = async (
  id: string
): Promise<ServerActionResponse<ExtensionModel>> => {
  const extensionResponse = await FindExtensionByID(id);
  const currentUser = await getCurrentUser();
  const hashedId = await userHashedId();

  if (extensionResponse.status === "OK") {
    // Only allow access if the user owns the extension
    if (extensionResponse.response.userId === hashedId) {
      return extensionResponse;
    } else {
      // Log unauthorized access attempts
      console.warn(`Unauthorized extension access attempt: User ${currentUser.email} (admin: ${currentUser.isAdmin}) tried to access extension ${id} owned by ${extensionResponse.response.userId}`);
    }
  }

  return {
    status: "UNAUTHORIZED",
    errors: [
      {
        message: `Extension not found with id: ${id}`,
      },
    ],
  };
};

// This function must only be used to retrieve the value within the APIs and Server functions.
// It should never be used to retrieve the value in the client.
export const FindSecureHeaderValue = async (
  headerId: string
): Promise<ServerActionResponse<string>> => {
  try {
    const vault = AzureKeyVaultInstance();
    const secret = await vault.getSecret(headerId);

    if (secret.value) {
      return {
        status: "OK",
        response: secret.value,
      };
    }

    return {
      status: "ERROR",
      errors: [
        {
          message: `Error finding secret: ${secret.value}`,
        },
      ],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error finding secret: ${error}`,
        },
      ],
    };
  }
};

export const DeleteExtension = async (
  id: string
): Promise<ServerActionResponse<ExtensionModel>> => {
  try {
    const extensionResponse = await EnsureExtensionOperation(id);

    if (extensionResponse.status === "OK") {
      const vault = AzureKeyVaultInstance();
      extensionResponse.response.headers.map(async (h) => {
        await vault.beginDeleteSecret(h.id);
      });

      const { resource } = await HistoryContainer()
        .item(id, extensionResponse.response.userId)
        .delete<ExtensionModel>();

      if (resource) {
        return {
          status: "OK",
          response: resource,
        };
      } else {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Error deleting Extension: ${resource}`,
            },
          ],
        };
      }
    }

    return extensionResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error deleting Extension: ${error}`,
        },
      ],
    };
  }
};

export const UpdateExtension = async (
  inputModel: ExtensionModel
): Promise<ServerActionResponse<ExtensionModel>> => {
  try {
    const extensionResponse = await EnsureExtensionOperation(inputModel.id);
    const user = await getCurrentUser();

    if (extensionResponse.status === "OK") {
      // Validate and sanitize basic extension fields
      const sanitizedName = sanitizeInput(inputModel.name, { maxLength: 100, allowNewlines: false });
      const sanitizedDescription = sanitizeInput(inputModel.description, { maxLength: 500, allowNewlines: true });
      const sanitizedExecutionSteps = sanitizeInput(inputModel.executionSteps, { maxLength: 2000, allowNewlines: true });

      if (!sanitizedName || !sanitizedDescription || !sanitizedExecutionSteps) {
        return {
          status: "ERROR",
          errors: [
            {
              message: "Extension name, description, and execution steps are required and cannot be empty.",
            },
          ],
        };
      }

      // Validate headers for security
      for (const header of inputModel.headers) {
        if (!header.key || !header.value) {
          return {
            status: "ERROR",
            errors: [
              {
                message: "All header keys and values must be provided.",
              },
            ],
          };
        }

        // Sanitize header key and value
        const sanitizedKey = sanitizeInput(header.key, { maxLength: 100, allowNewlines: false });
        const sanitizedValue = sanitizeInput(header.value, { maxLength: 1000, allowNewlines: false });

        if (!sanitizedKey || !sanitizedValue) {
          return {
            status: "ERROR",
            errors: [
              {
                message: "Header keys and values cannot be empty after sanitization.",
              },
            ],
          };
        }

        header.key = sanitizedKey;
        header.value = sanitizedValue;
        if (!header.id) {
          header.id = uniqueId();
        }
      }

      // Validate functions
      for (const func of inputModel.functions) {
        if (!func.endpoint || typeof func.endpoint !== 'string') {
          return {
            status: "ERROR",
            errors: [
              {
                message: "Function endpoint is required.",
              },
            ],
          };
        }

        // Sanitize and validate endpoint URL
        const sanitizedEndpoint = sanitizeInput(func.endpoint, { maxLength: 500, allowNewlines: false });
        if (!sanitizedEndpoint) {
          return {
            status: "ERROR",
            errors: [
              {
                message: "Function endpoint cannot be empty.",
              },
            ],
          };
        }

        // Basic URL validation
        try {
          new URL(sanitizedEndpoint);
        } catch {
          return {
            status: "ERROR",
            errors: [
              {
                message: `Invalid URL format for endpoint: ${sanitizedEndpoint}`,
              },
            ],
          };
        }

        func.endpoint = sanitizedEndpoint;
        if (!func.id) {
          func.id = uniqueId();
        }
      }

      inputModel.name = sanitizedName;
      inputModel.description = sanitizedDescription;
      inputModel.executionSteps = sanitizedExecutionSteps;
      inputModel.isPublished = user.isAdmin
        ? inputModel.isPublished
        : extensionResponse.response.isPublished;

      inputModel.userId = extensionResponse.response.userId;
      inputModel.createdAt = new Date();
      inputModel.type = "EXTENSION";

      // schema validation
      const validatedFields = validateSchema(inputModel);

      if (validatedFields.status === "OK") {
        await secureHeaderValues(inputModel);

        const { resource } =
          await HistoryContainer().items.upsert<ExtensionModel>(inputModel);

        if (resource) {
          return {
            status: "OK",
            response: resource,
          };
        } else {
          return {
            status: "ERROR",
            errors: [
              {
                message: `Error updating Extension: ${resource}`,
              },
            ],
          };
        }
      } else {
        return validatedFields;
      }
    } else {
      return extensionResponse;
    }
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error updating Extension: ${error}`,
        },
      ],
    };
  }
};

export const FindAllExtensionForCurrentUser = async (): Promise<
  ServerActionResponse<Array<ExtensionModel>>
> => {
  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND (r.isPublished=@isPublished OR r.userId=@userId) ORDER BY r.createdAt DESC",
      parameters: [
        {
          name: "@type",
          value: EXTENSION_ATTRIBUTE,
        },
        {
          name: "@isPublished",
          value: true,
        },
        {
          name: "@userId",
          value: await userHashedId(),
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<ExtensionModel>(querySpec)
      .fetchAll();

    return {
      status: "OK",
      response: resources,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error finding Extension: ${error}`,
        },
      ],
    };
  }
};

export const CreateChatWithExtension = async (
  extensionId: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  const extensionResponse = await FindExtensionByID(extensionId);

  if (extensionResponse.status === "OK") {
    const extension = extensionResponse.response;

    const response = await UpsertChatThread({
      name: extension.name,
      useName: (await userSession())!.name,
      userId: await userHashedId(),
      id: "",
      createdAt: new Date(),
      lastMessageAt: new Date(),
      bookmarked: false,
      isDeleted: false,
      type: CHAT_THREAD_ATTRIBUTE,
      personaMessage: "",
      personaMessageTitle: CHAT_DEFAULT_PERSONA,
      extension: [extension.id],
    });

    return response;
  } else {
    return {
      status: "ERROR",
      errors: extensionResponse.errors,
    };
  }
};

const validateSchema = (model: ExtensionModel): ServerActionResponse => {
  const validatedFields = ExtensionModelSchema.safeParse(model);

  if (!validatedFields.success) {
    return {
      status: "ERROR",
      errors: zodErrorsToServerActionErrors(validatedFields.error.errors),
    };
  }

  return validateFunctionSchema(model);
};

const validateFunctionSchema = (
  model: ExtensionModel
): ServerActionResponse => {
  let functionNames: string[] = [];

  for (let i = 0; i < model.functions.length; i++) {
    const f = model.functions[i];
    
    // Validate and sanitize function code before parsing
    if (!f.code || typeof f.code !== 'string') {
      return {
        status: "ERROR",
        errors: [
          {
            message: `Function code is required and must be a string.`,
          },
        ],
      };
    }

    // Sanitize function code to prevent injection
    const sanitizedCode = sanitizeInput(f.code, { 
      maxLength: 50000, // Allow reasonable JSON schema size
      allowNewlines: true,
      allowBasicFormatting: false
    });

    if (sanitizedCode.length === 0) {
      return {
        status: "ERROR",
        errors: [
          {
            message: `Function code cannot be empty.`,
          },
        ],
      };
    }

    // Basic security check - reject code containing potential dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/i,
      /import\s+/i,
      /eval\s*\(/i,
      /function\s*\(/i,
      /=>\s*{/i,
      /new\s+Function/i,
      /setTimeout/i,
      /setInterval/i,
      /process\./i,
      /global\./i,
      /__dirname/i,
      /__filename/i,
      /Buffer\./i,
      /fs\./i,
      /child_process/i,
      /crypto\./i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitizedCode)) {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function code contains potentially dangerous patterns. Only JSON schema definitions are allowed.`,
            },
          ],
        };
      }
    }

    try {
      const functionSchema = JSON.parse(sanitizedCode);
      
      // Validate that it's a valid OpenAI function schema structure
      if (typeof functionSchema !== 'object' || functionSchema === null) {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function schema must be a valid JSON object.`,
            },
          ],
        };
      }

      // Required fields validation
      if (!functionSchema.name || typeof functionSchema.name !== 'string') {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function schema must have a valid 'name' field.`,
            },
          ],
        };
      }

      if (!functionSchema.description || typeof functionSchema.description !== 'string') {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function schema must have a valid 'description' field.`,
            },
          ],
        };
      }

      const name = functionSchema.name;
      const findName = functionNames.find((n) => n === name);

      // Validate function name format
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function name '${name}' must start with a letter and contain only letters, numbers, and underscores.`,
            },
          ],
        };
      }

      if (name.length > 64) {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function name '${name}' cannot exceed 64 characters.`,
            },
          ],
        };
      }

      if (findName) {
        return {
          status: "ERROR",
          errors: [
            {
              message: `Function name ${name} is already used. Please use a different name.`,
            },
          ],
        };
      } else {
        functionNames.push(name);
      }

      // Update the function with sanitized code
      f.code = sanitizedCode;
      
    } catch (error) {
      return {
        status: "ERROR",
        errors: [
          {
            message: `Invalid JSON in function schema: ${error}. Please provide a valid OpenAI function schema.`,
          },
        ],
      };
    }
  }

  if (functionNames.length === 0) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `At least one function is required.`,
        },
      ],
    };
  }

  return {
    status: "OK",
    response: model,
  };
};
