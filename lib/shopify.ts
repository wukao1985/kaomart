import { Product } from "./types";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function fetchShopifyToken(): Promise<string> {
  const res = await fetch("https://api.shopify.com/auth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify token fetch failed: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getShopifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }
  const accessToken = await fetchShopifyToken();
  // Cache for 50 minutes (token valid for 1 hour)
  cachedToken = { accessToken, expiresAt: Date.now() + 50 * 60 * 1000 };
  return accessToken;
}

function invalidateToken() {
  cachedToken = null;
}

async function callShopifyMCP(
  body: object,
  retry = true
): Promise<unknown> {
  const token = await getShopifyToken();
  const res = await fetch("https://discover.shopifyapps.com/global/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 && retry) {
    invalidateToken();
    return callShopifyMCP(body, false);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify MCP error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function searchProducts(
  query: string,
  context: string,
  limit: number = 3
): Promise<Product[]> {
  const result = await callShopifyMCP({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "search_global_products",
      arguments: { query, context, limit },
    },
  });
  return parseProductResults(result);
}

export async function getProductDetails(
  offerId: string
): Promise<Product | null> {
  const result = await callShopifyMCP({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 2,
    params: {
      name: "get_global_product_details",
      arguments: { offer_id: offerId },
    },
  });
  const products = parseProductResults(result);
  return products[0] ?? null;
}

function parseProductResults(result: unknown): Product[] {
  try {
    const r = result as {
      result?: { content?: Array<{ type: string; text: string }> };
    };
    const content = r?.result?.content;
    if (!content || !Array.isArray(content)) return [];

    // The MCP response contains text content with product data
    const textContent = content.find((c) => c.type === "text");
    if (!textContent?.text) return [];

    // Try to parse the text as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(textContent.text);
    } catch {
      // Text might contain product info in a different format
      // Return empty and let Gemini handle the raw text
      return extractProductsFromText(textContent.text);
    }

    if (Array.isArray(parsed)) {
      return parsed.map(normalizeProduct);
    }
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.products)) {
        return obj.products.map(normalizeProduct);
      }
      if (Array.isArray(obj.offers)) {
        return obj.offers.map(normalizeProduct);
      }
      // Single product
      return [normalizeProduct(parsed)];
    }
    return [];
  } catch {
    return [];
  }
}

function normalizeProduct(raw: unknown): Product {
  const p = raw as Record<string, unknown>;
  return {
    id: String(p.id || p.offer_id || p.offerId || ""),
    title: String(p.title || p.name || "Unknown Product"),
    price: String(p.price || p.amount || "0"),
    currency: String(p.currency || p.currencyCode || "USD"),
    image: String(
      p.image || p.imageUrl || p.image_url || p.featuredImage || ""
    ),
    rating: Number(p.rating || p.score || 0),
    checkoutUrl: String(p.checkoutUrl || p.checkout_url || p.url || "#"),
    vendor: String(p.vendor || p.shop || p.store || ""),
  };
}

function extractProductsFromText(text: string): Product[] {
  // Fallback: try to find JSON objects within the text
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr)) return arr.map(normalizeProduct);
    } catch {
      // ignore
    }
  }
  return [];
}
