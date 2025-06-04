import { SearchAzureAISimilarDocuments } from "@/features/chat-page/chat-services/chat-api/chat-api-rag-extension";
import { validateChatMessage } from "@/features/common/services/validation-service";

export async function POST(req: Request) {
  try {
    // Validate request body
    const body = await req.json();
    
    if (!body.search || typeof body.search !== "string") {
      return new Response(JSON.stringify({ 
        error: "Invalid search query" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate and sanitize search input
    const searchValidation = validateChatMessage(body.search);
    if (searchValidation.status !== "OK") {
      return new Response(JSON.stringify({ 
        error: searchValidation.errors[0].message 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return SearchAzureAISimilarDocuments(req);
  } catch (error) {
    console.error("Document API error:", error);
    return new Response(JSON.stringify({ 
      error: "Invalid request format" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
