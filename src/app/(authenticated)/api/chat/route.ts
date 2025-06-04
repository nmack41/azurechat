import { ChatAPIEntry } from "@/features/chat-page/chat-services/chat-api/chat-api";
import { UserPrompt } from "@/features/chat-page/chat-services/models";
import { validateChatMessage } from "@/features/common/services/validation-service";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const content = formData.get("content");
    const multimodalImage = formData.get("image-base64");

    // Validate content is a string
    if (typeof content !== "string") {
      return new Response(JSON.stringify({ error: "Invalid content format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Parse and validate user prompt
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON content" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate message content
    if (parsedContent.message) {
      const messageValidation = validateChatMessage(parsedContent.message);
      if (messageValidation.status !== "OK") {
        return new Response(JSON.stringify({ 
          error: messageValidation.errors[0].message 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      parsedContent.message = messageValidation.response;
    }

    // Validate multimodal image if provided
    if (multimodalImage && typeof multimodalImage === "string") {
      // Basic validation for base64 image
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
      if (!base64Regex.test(multimodalImage)) {
        return new Response(JSON.stringify({ 
          error: "Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed." 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Check base64 size (5MB limit after encoding)
      const base64Size = multimodalImage.length * 0.75; // Approximate decoded size
      if (base64Size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ 
          error: "Image size exceeds 5MB limit" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const userPrompt: UserPrompt = {
      ...parsedContent,
      multimodalImage: typeof multimodalImage === "string" ? multimodalImage : undefined,
    };

    return await ChatAPIEntry(userPrompt, req.signal);
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ 
      error: "An error occurred processing your request" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
