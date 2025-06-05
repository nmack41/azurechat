"use server";
import "server-only";

import { getCurrentUser, userHashedId } from "@/features/auth-page/helpers";
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
import { uniqueId } from "@/utils/util";
import { SqlQuerySpec } from "@azure/cosmos";
import { PERSONA_ATTRIBUTE, PersonaModel, PersonaModelSchema } from "./models";

interface PersonaInput {
  name: string;
  description: string;
  personaMessage: string;
  isPublished: boolean;
}

export const FindPersonaByID = async (
  id: string
): Promise<ServerActionResponse<PersonaModel>> => {
  try {
    const querySpec: SqlQuerySpec = {
      query: "SELECT * FROM root r WHERE r.type=@type AND r.id=@id",
      parameters: [
        {
          name: "@type",
          value: PERSONA_ATTRIBUTE,
        },
        {
          name: "@id",
          value: id,
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<PersonaModel>(querySpec)
      .fetchAll();

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [
          {
            message: "Persona not found",
          },
        ],
      };
    }

    return {
      status: "OK",
      response: resources[0],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error creating persona: ${error}`,
        },
      ],
    };
  }
};

export const CreatePersona = async (
  props: PersonaInput
): Promise<ServerActionResponse<PersonaModel>> => {
  try {
    const user = await getCurrentUser();

    // Validate and sanitize persona fields
    const sanitizedName = sanitizeInput(props.name, { maxLength: 100, allowNewlines: false });
    const sanitizedDescription = sanitizeInput(props.description, { maxLength: 500, allowNewlines: true });
    const sanitizedPersonaMessage = sanitizeInput(props.personaMessage, { maxLength: 2000, allowNewlines: true });

    if (!sanitizedName || !sanitizedDescription || !sanitizedPersonaMessage) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Persona name, description, and system message are required and cannot be empty.",
          },
        ],
      };
    }

    // Additional validation for system prompt injection
    const dangerousPatterns = [
      /ignore.*previous.*instruction/i,
      /ignore.*above.*instruction/i,
      /forget.*previous.*instruction/i,
      /you.*are.*now/i,
      /act.*as.*if/i,
      /pretend.*to.*be/i,
      /roleplay.*as/i,
      /simulate.*being/i,
      /behave.*like/i,
      /respond.*as.*if.*you.*are/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitizedPersonaMessage)) {
        return {
          status: "ERROR",
          errors: [
            {
              message: "System message contains potentially dangerous prompt injection patterns.",
            },
          ],
        };
      }
    }

    const modelToSave: PersonaModel = {
      id: uniqueId(),
      name: sanitizedName,
      description: sanitizedDescription,
      personaMessage: sanitizedPersonaMessage,
      isPublished: user.isAdmin ? props.isPublished : false,
      userId: await userHashedId(),
      createdAt: new Date(),
      type: "PERSONA",
    };

    const valid = ValidateSchema(modelToSave);

    if (valid.status !== "OK") {
      return valid;
    }

    const { resource } = await HistoryContainer().items.create<PersonaModel>(
      modelToSave
    );

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
            message: "Error creating persona",
          },
        ],
      };
    }
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error creating persona: ${error}`,
        },
      ],
    };
  }
};

export const EnsurePersonaOperation = async (
  personaId: string
): Promise<ServerActionResponse<PersonaModel>> => {
  const personaResponse = await FindPersonaByID(personaId);
  const currentUser = await getCurrentUser();
  const hashedId = await userHashedId();

  if (personaResponse.status === "OK") {
    // Only allow access if the user owns the persona
    if (personaResponse.response.userId === hashedId) {
      return personaResponse;
    } else {
      // Log unauthorized access attempts
      console.warn(`Unauthorized persona access attempt: User ${currentUser.email} (admin: ${currentUser.isAdmin}) tried to access persona ${personaId} owned by ${personaResponse.response.userId}`);
    }
  }

  return {
    status: "UNAUTHORIZED",
    errors: [
      {
        message: `Persona not found with id: ${personaId}`,
      },
    ],
  };
};

export const DeletePersona = async (
  personaId: string
): Promise<ServerActionResponse<PersonaModel>> => {
  try {
    const personaResponse = await EnsurePersonaOperation(personaId);

    if (personaResponse.status === "OK") {
      const { resource: deletedPersona } = await HistoryContainer()
        .item(personaId, personaResponse.response.userId)
        .delete();

      return {
        status: "OK",
        response: deletedPersona,
      };
    }

    return personaResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error deleting persona: ${error}`,
        },
      ],
    };
  }
};

export const UpsertPersona = async (
  personaInput: PersonaModel
): Promise<ServerActionResponse<PersonaModel>> => {
  try {
    const personaResponse = await EnsurePersonaOperation(personaInput.id);

    if (personaResponse.status === "OK") {
      const { response: persona } = personaResponse;
      const user = await getCurrentUser();

      // Validate and sanitize persona fields
      const sanitizedName = sanitizeInput(personaInput.name, { maxLength: 100, allowNewlines: false });
      const sanitizedDescription = sanitizeInput(personaInput.description, { maxLength: 500, allowNewlines: true });
      const sanitizedPersonaMessage = sanitizeInput(personaInput.personaMessage, { maxLength: 2000, allowNewlines: true });

      if (!sanitizedName || !sanitizedDescription || !sanitizedPersonaMessage) {
        return {
          status: "ERROR",
          errors: [
            {
              message: "Persona name, description, and system message are required and cannot be empty.",
            },
          ],
        };
      }

      // Additional validation for system prompt injection
      const dangerousPatterns = [
        /ignore.*previous.*instruction/i,
        /ignore.*above.*instruction/i,
        /forget.*previous.*instruction/i,
        /you.*are.*now/i,
        /act.*as.*if/i,
        /pretend.*to.*be/i,
        /roleplay.*as/i,
        /simulate.*being/i,
        /behave.*like/i,
        /respond.*as.*if.*you.*are/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(sanitizedPersonaMessage)) {
          return {
            status: "ERROR",
            errors: [
              {
                message: "System message contains potentially dangerous prompt injection patterns.",
              },
            ],
          };
        }
      }

      const modelToUpdate: PersonaModel = {
        ...persona,
        name: sanitizedName,
        description: sanitizedDescription,
        personaMessage: sanitizedPersonaMessage,
        isPublished: user.isAdmin
          ? personaInput.isPublished
          : persona.isPublished,
        createdAt: new Date(),
      };

      const validationResponse = ValidateSchema(modelToUpdate);
      if (validationResponse.status !== "OK") {
        return validationResponse;
      }

      const { resource } = await HistoryContainer().items.upsert<PersonaModel>(
        modelToUpdate
      );

      if (resource) {
        return {
          status: "OK",
          response: resource,
        };
      }

      return {
        status: "ERROR",
        errors: [
          {
            message: "Error updating persona",
          },
        ],
      };
    }

    return personaResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Error updating persona: ${error}`,
        },
      ],
    };
  }
};

export const FindAllPersonaForCurrentUser = async (): Promise<
  ServerActionResponse<Array<PersonaModel>>
> => {
  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND (r.isPublished=@isPublished OR r.userId=@userId) ORDER BY r.createdAt DESC",
      parameters: [
        {
          name: "@type",
          value: PERSONA_ATTRIBUTE,
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
      .items.query<PersonaModel>(querySpec)
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
          message: `Error finding persona: ${error}`,
        },
      ],
    };
  }
};

export const CreatePersonaChat = async (
  personaId: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  const personaResponse = await FindPersonaByID(personaId);
  const user = await getCurrentUser();

  if (personaResponse.status === "OK") {
    const persona = personaResponse.response;

    const response = await UpsertChatThread({
      name: persona.name,
      useName: user.name,
      userId: await userHashedId(),
      id: "",
      createdAt: new Date(),
      lastMessageAt: new Date(),
      bookmarked: false,
      isDeleted: false,
      type: CHAT_THREAD_ATTRIBUTE,
      personaMessage: persona.personaMessage,
      personaMessageTitle: persona.name,
      extension: [],
    });

    return response;
  }
  return personaResponse;
};

const ValidateSchema = (model: PersonaModel): ServerActionResponse => {
  const validatedFields = PersonaModelSchema.safeParse(model);

  if (!validatedFields.success) {
    return {
      status: "ERROR",
      errors: zodErrorsToServerActionErrors(validatedFields.error.errors),
    };
  }

  return {
    status: "OK",
    response: model,
  };
};
