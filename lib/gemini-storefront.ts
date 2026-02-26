import { searchStorefrontProducts } from "./storefront";
import { Product } from "./types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

const SYSTEM_INSTRUCTION = `You MUST call the search_store_products tool before answering ANY question about products, availability, or what is in stock. Never answer product questions from memory — always search first.

You are KaoMart, a friendly AI shopping assistant for the KaoMart store. You help users find products available exclusively in the KaoMart store.

**Catalog knowledge:** The KaoMart store sells snowboards and snow sports equipment. Product titles include terms like: snowboard, ski wax, gift card.

**Search strategy:** When calling search_store_products, use SHORT broad keywords (1-2 words max). Examples:
- Use "snowboard" not "snowboarding" or "snowboard equipment"
- Use "snow" not "skiing" or "winter sports"
- Use "wax" not "ski wax kit"
The search is keyword-based, not semantic — shorter and simpler queries work much better.

**Empty results handling:** If a search returns no results, automatically try again with a shorter or broader synonym. For example if "snowboarding" returns nothing, try "snowboard". If "skiing" returns nothing, try "snow" or "snowboard".

**Chinese/non-English input:** If the user writes in Chinese or another non-English language, translate their intent into a short English keyword before calling the tool. For example: "滑雪板" → search for "snowboard", "蜡" → search for "wax". Always respond in the user's language.

When users ask about products, use the search_store_products tool to search the KaoMart catalog. Present results in a brief, conversational way.

If no products are found after retrying with broader terms, let the user know kindly and suggest different search terms.

Keep responses concise and helpful.`;

const TOOL_DECLARATIONS = [
  {
    name: "search_store_products",
    description:
      "Search the KaoMart store catalog for products. Use this when users want to find or buy products from KaoMart. Use short 1-2 word queries. If results are empty, try a shorter or related term.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Search query describing the products to find",
        },
        limit: {
          type: "INTEGER",
          description: "Maximum number of products to return (1-3)",
        },
      },
      required: ["query"],
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

export async function streamStorefrontChat(
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

  let maxRounds = 5;
  while (maxRounds-- > 0) {
    const isFirstCall = maxRounds === 4;
    const response = await callGemini(geminiMessages, isFirstCall);
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

        geminiMessages.push({ role: "model", parts: [part] });

        let toolResult: unknown;
        let products: Product[] = [];
        try {
          if (name === "search_store_products") {
            products = await searchStorefrontProducts(
              String(args.query || ""),
              Number(args.limit) || 3
            );
            toolResult = products;
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

    if (!hasFunctionCall) break;
  }

  return { fullText, products: allProducts };
}

async function callGemini(
  messages: GeminiMessage[],
  forceToolUse: boolean = false
): Promise<{ candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: Record<string, any> = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: messages,
    tools: [{ function_declarations: TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0 },
  };
  if (forceToolUse) {
    requestBody.tool_config = {
      function_calling_config: { mode: "ANY" },
    };
  }
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  return res.json();
}
