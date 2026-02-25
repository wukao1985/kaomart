import { searchProducts, getProductDetails } from "./shopify";
import { Product } from "./types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

const SYSTEM_INSTRUCTION = `You are KaoMart, a friendly and helpful AI shopping assistant. You help users find and purchase products.

When users ask about products, use the search_products tool to find relevant items. Present results in a brief, conversational way - mention the key highlights of what you found. Don't list raw data; summarize naturally.

If no products are found, let the user know kindly and suggest refining their search.

Keep responses concise and helpful. You can handle follow-up questions, comparisons, and general shopping advice.`;

const TOOL_DECLARATIONS = [
  {
    name: "search_products",
    description:
      "Search the Shopify global catalog for products matching a query. Use this when users want to find, browse, or buy products.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Search query describing the products to find",
        },
        context: {
          type: "STRING",
          description:
            "Additional context about the buyer's intent or preferences",
        },
        limit: {
          type: "INTEGER",
          description: "Maximum number of products to return (1-3)",
        },
      },
      required: ["query", "context"],
    },
  },
  {
    name: "get_product_details",
    description:
      "Get detailed information about a specific product by its offer ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        offer_id: {
          type: "STRING",
          description: "The Shopify global offer ID of the product",
        },
      },
      required: ["offer_id"],
    },
  },
];

interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | {
      functionResponse: {
        name: string;
        response: { content: unknown };
      };
    };

export async function streamChat(
  conversationHistory: { role: string; content: string }[],
  onText: (text: string) => void,
  onProducts: (products: Product[]) => void
): Promise<{ fullText: string; products: Product[] }> {
  const geminiMessages: GeminiMessage[] = conversationHistory.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  let fullText = "";
  let allProducts: Product[] = [];

  // Gemini may do multiple rounds of tool calls
  let maxRounds = 5;
  while (maxRounds-- > 0) {
    const response = await callGemini(geminiMessages);
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) break;

    const parts: GeminiPart[] = candidate.content.parts;

    let hasFunctionCall = false;
    const textParts: string[] = [];

    for (const part of parts) {
      if ("text" in part && part.text) {
        textParts.push(part.text);
        onText(part.text);
      }
      if ("functionCall" in part) {
        hasFunctionCall = true;
        const { name, args } = part.functionCall;

        // Add the model's response (with functionCall) to history
        geminiMessages.push({ role: "model", parts: [part] });

        // Execute the tool
        let toolResult: unknown;
        let products: Product[] = [];
        try {
          if (name === "search_products") {
            products = await searchProducts(
              String(args.query || ""),
              String(args.context || ""),
              Number(args.limit) || 3
            );
            toolResult = products;
          } else if (name === "get_product_details") {
            const product = await getProductDetails(
              String(args.offer_id || "")
            );
            products = product ? [product] : [];
            toolResult = product;
          } else {
            toolResult = { error: `Unknown tool: ${name}` };
          }
        } catch (err) {
          toolResult = {
            error: err instanceof Error ? err.message : "Tool call failed",
          };
        }

        if (products.length > 0) {
          allProducts = allProducts.concat(products);
          onProducts(products);
        }

        // Send function response back to Gemini
        geminiMessages.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: { content: toolResult },
              },
            },
          ],
        });
      }
    }

    if (textParts.length > 0) {
      fullText += textParts.join("");
    }

    // If no function call, we're done
    if (!hasFunctionCall) break;
  }

  return { fullText, products: allProducts };
}

async function callGemini(
  messages: GeminiMessage[]
): Promise<{ candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: messages,
      tools: [{ function_declarations: TOOL_DECLARATIONS }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  return res.json();
}
