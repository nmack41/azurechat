import {
  GetImageFromStore,
  GetThreadAndImageFromUrl,
} from "./chat-image-service";
import { sanitizeInput } from "@/services/validation-service";

export const ImageAPIEntry = async (request: Request): Promise<Response> => {
  try {
    const urlPath = request.url;

    // Validate URL format
    if (!urlPath || typeof urlPath !== 'string') {
      return new Response("Invalid URL", { status: 400 });
    }

    // Basic URL length validation
    if (urlPath.length > 2000) {
      return new Response("URL too long", { status: 400 });
    }

    const response = GetThreadAndImageFromUrl(urlPath);

    if (response.status !== "OK") {
      return new Response(response.errors[0].message, { status: 400 });
    }

    const { threadId, imgName } = response.response;
    
    // Additional validation after extracting parameters
    const sanitizedThreadId = sanitizeInput(threadId, { maxLength: 100, allowNewlines: false });
    const sanitizedImgName = sanitizeInput(imgName, { maxLength: 255, allowNewlines: false });

    if (!sanitizedThreadId || !sanitizedImgName) {
      return new Response("Invalid thread ID or image name", { status: 400 });
    }

    // Validate image name format (only allow safe characters)
    if (!/^[a-zA-Z0-9\-_\.]+\.(png|jpg|jpeg|gif|webp)$/i.test(sanitizedImgName)) {
      return new Response("Invalid image file format", { status: 400 });
    }

    // Validate thread ID format
    if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitizedThreadId)) {
      return new Response("Invalid thread ID format", { status: 400 });
    }

    const imageData = await GetImageFromStore(sanitizedThreadId, sanitizedImgName);

    if (imageData.status === "OK") {
      // Determine content type based on file extension
      const extension = sanitizedImgName.split('.').pop()?.toLowerCase();
      const contentType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' :
                         extension === 'png' ? 'image/png' :
                         extension === 'gif' ? 'image/gif' :
                         extension === 'webp' ? 'image/webp' : 'image/png';

      return new Response(imageData.response, {
        headers: { 
          "content-type": contentType,
          "cache-control": "private, max-age=3600" // 1 hour cache
        },
      });
    } else {
      return new Response(imageData.errors[0].message, { status: 404 });
    }
  } catch (error) {
    console.error("Image API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
