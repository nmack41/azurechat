import "server-only";

import { ServerActionResponse } from "@/utils/server-action-response";
import { GetBlob, UploadBlob } from "../../common/services/azure-storage";
import { sanitizeInput } from "@/services/validation-service";

const IMAGE_CONTAINER_NAME = "images";
const IMAGE_API_PATH = process.env.NEXTAUTH_URL + "/api/images";

export const GetBlobPath = (threadId: string, blobName: string): string => {
  return `${threadId}/${blobName}`;
};

export const UploadImageToStore = async (
  threadId: string,
  fileName: string,
  imageData: Buffer
): Promise<ServerActionResponse<string>> => {
  return await UploadBlob(
    IMAGE_CONTAINER_NAME,
    `${threadId}/${fileName}`,
    imageData
  );
};

export const GetImageFromStore = async (
  threadId: string,
  fileName: string
): Promise<ServerActionResponse<ReadableStream>> => {
  const blobPath = GetBlobPath(threadId, fileName);
  return await GetBlob(IMAGE_CONTAINER_NAME, blobPath);
};

export const GetImageUrl = (threadId: string, fileName: string): string => {
  // add threadId and fileName as query parameters t and img respectively
  const params = `?t=${threadId}&img=${fileName}`;

  return `${IMAGE_API_PATH}/${params}`;
};

export const GetThreadAndImageFromUrl = (
  urlString: string
): ServerActionResponse<{ threadId: string; imgName: string }> => {
  try {
    // Validate input URL string
    if (!urlString || typeof urlString !== 'string') {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Invalid URL string provided.",
          },
        ],
      };
    }

    // Basic URL validation
    if (urlString.length > 2000) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "URL too long.",
          },
        ],
      };
    }

    const url = new URL(urlString);
    const threadId = url.searchParams.get("t");
    const imgName = url.searchParams.get("img");

    // Check if threadId and img are valid
    if (!threadId || !imgName) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Missing required parameters: threadId (t) and/or imgName (img).",
          },
        ],
      };
    }

    // Sanitize and validate parameters
    const sanitizedThreadId = sanitizeInput(threadId, { maxLength: 100, allowNewlines: false });
    const sanitizedImgName = sanitizeInput(imgName, { maxLength: 255, allowNewlines: false });

    if (!sanitizedThreadId || !sanitizedImgName) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Invalid threadId or imgName after sanitization.",
          },
        ],
      };
    }

    // Validate threadId format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedThreadId)) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Invalid threadId format. Only alphanumeric characters, hyphens, and underscores allowed.",
          },
        ],
      };
    }

    // Validate image name format (safe filename with extension)
    if (!/^[a-zA-Z0-9\-_\.]+\.(png|jpg|jpeg|gif|webp)$/i.test(sanitizedImgName)) {
      return {
        status: "ERROR",
        errors: [
          {
            message: "Invalid image name format. Must be a valid image file with extension.",
          },
        ],
      };
    }

    return {
      status: "OK",
      response: {
        threadId: sanitizedThreadId,
        imgName: sanitizedImgName,
      },
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [
        {
          message: `Invalid URL format: ${error}`,
        },
      ],
    };
  }
};
