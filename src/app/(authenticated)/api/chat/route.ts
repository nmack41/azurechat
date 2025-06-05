import { ChatAPIEntry } from "@/features/chat-page/chat-services/chat-api/chat-api";
import { UserPrompt } from "@/features/chat-page/chat-services/models";
import { validateChatMessage } from "@/services/validation-service";
import { 
  getCorrelationId, 
  CORRELATION_ID_HEADER,
  addCorrelationHeaders
} from "@/observability/correlation-middleware";
import { ErrorSerializer } from "@/errors";

export async function POST(req: Request) {
  // Extract correlation ID from request
  const correlationId = getCorrelationId(req as any);
  const startTime = Date.now();
  
  try {
    console.log(`Chat API request started`, {
      correlationId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
    });

    const formData = await req.formData();
    const content = formData.get("content");
    const multimodalImage = formData.get("image-base64");

    // Validate content is a string
    if (typeof content !== "string") {
      const response = new Response(JSON.stringify({ 
        error: "Invalid content format",
        correlationId 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      
      return addCorrelationHeaders(response as any, correlationId);
    }

    // Parse and validate user prompt
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      const response = new Response(JSON.stringify({ 
        error: "Invalid JSON content",
        correlationId 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
      
      return addCorrelationHeaders(response as any, correlationId);
    }

    // Validate message content
    if (parsedContent.message) {
      const messageValidation = validateChatMessage(parsedContent.message);
      if (messageValidation.status !== "OK") {
        const response = new Response(JSON.stringify({ 
          error: messageValidation.errors[0].message,
          correlationId 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        
        return addCorrelationHeaders(response as any, correlationId);
      }
      parsedContent.message = messageValidation.response;
    }

    // Validate multimodal image if provided
    if (multimodalImage && typeof multimodalImage === "string") {
      // Basic validation for base64 image
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
      if (!base64Regex.test(multimodalImage)) {
        const response = new Response(JSON.stringify({ 
          error: "Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.",
          correlationId 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        
        return addCorrelationHeaders(response as any, correlationId);
      }

      // Check base64 size (5MB limit after encoding)
      const base64Size = multimodalImage.length * 0.75; // Approximate decoded size
      if (base64Size > 5 * 1024 * 1024) {
        const response = new Response(JSON.stringify({ 
          error: "Image size exceeds 5MB limit",
          correlationId 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
        
        return addCorrelationHeaders(response as any, correlationId);
      }
    }

    const userPrompt: UserPrompt = {
      ...parsedContent,
      multimodalImage: typeof multimodalImage === "string" ? multimodalImage : undefined,
      correlationId, // Add correlation ID to user prompt
    };

    const result = await ChatAPIEntry(userPrompt, req.signal);
    
    // Log successful request
    const duration = Date.now() - startTime;
    console.log(`Chat API request completed`, {
      correlationId,
      duration,
      timestamp: new Date().toISOString(),
    });

    return addCorrelationHeaders(result, correlationId);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error("Chat API error:", {
      correlationId,
      duration,
      timestamp: new Date().toISOString(),
      error: ErrorSerializer.serialize(error),
    });
    
    const response = new Response(JSON.stringify({ 
      error: "An error occurred processing your request",
      correlationId 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
    
    return addCorrelationHeaders(response as any, correlationId);
  }
}
