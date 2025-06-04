import { ExtensionSimilaritySearch } from "../azure-ai-search/azure-ai-search";
import { CreateCitations, FormatCitations } from "../citation-service";
import { validateChatMessage, sanitizeInput } from "@/features/common/services/validation-service";

export const SearchAzureAISimilarDocuments = async (req: Request) => {
  try {
    const body = await req.json();
    const search = body.search as string;

    // Validate search input
    const searchValidation = validateChatMessage(search);
    if (searchValidation.status !== "OK") {
      return new Response(JSON.stringify({
        status: "ERROR",
        errors: searchValidation.errors
      }), { status: 400 });
    }

    // Validate and sanitize headers
    const vectors = req.headers.get("vectors") as string;
    const apiKey = req.headers.get("apiKey") as string;
    const searchName = req.headers.get("searchName") as string;
    const indexName = req.headers.get("indexName") as string;
    const userId = req.headers.get("authorization") as string;

    // Validate required headers
    if (!vectors || !apiKey || !searchName || !indexName || !userId) {
      return new Response(JSON.stringify({
        status: "ERROR",
        errors: [{ message: "Missing required headers" }]
      }), { status: 400 });
    }

    // Sanitize header values to prevent injection
    const sanitizedSearchName = sanitizeInput(searchName, { maxLength: 100, allowNewlines: false });
    const sanitizedIndexName = sanitizeInput(indexName, { maxLength: 100, allowNewlines: false });
    
    // Validate API key format (basic validation)
    if (!/^[A-Za-z0-9+/=\-_]{10,}$/.test(apiKey)) {
      return new Response(JSON.stringify({
        status: "ERROR", 
        errors: [{ message: "Invalid API key format" }]
      }), { status: 400 });
    }

    // Validate vectors format
    if (!/^[A-Za-z0-9,.\-_]+$/.test(vectors)) {
      return new Response(JSON.stringify({
        status: "ERROR",
        errors: [{ message: "Invalid vectors format" }]
      }), { status: 400 });
    }

    const result = await ExtensionSimilaritySearch({
      apiKey,
      searchName: sanitizedSearchName,
      indexName: sanitizedIndexName,
      vectors: vectors.split(","),
      searchText: searchValidation.response,
    });

    if (result.status !== "OK") {
      console.error("🔴 Retrieving documents", result.errors);
      return new Response(JSON.stringify(result));
    }

    const withoutEmbedding = FormatCitations(result.response);
    const citationResponse = await CreateCitations(withoutEmbedding, userId);

    // only get the citations that are ok
    const allCitations = [];
    for (const citation of citationResponse) {
      if (citation.status === "OK") {
        allCitations.push({
          id: citation.response.id,
          content: citation.response.content,
        });
      }
    }

    return new Response(JSON.stringify(allCitations));
  } catch (e) {
    console.error("🔴 Retrieving documents", e);
    return new Response(JSON.stringify(e));
  }
};
