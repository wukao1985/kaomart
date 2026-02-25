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

  // Extract price from Shopify Catalog MCP nested structure
  const priceRange = p.priceRange as Record<string, unknown> | undefined;
  const minPrice = (priceRange?.min as Record<string, unknown>) || (priceRange as Record<string, unknown>);
  const rawAmount = Number(minPrice?.amount || p.price || p.amount || 0);
  // Shopify returns price in cents (11000 = $110.00)
  const priceInDollars = rawAmount > 1000 ? (rawAmount / 100).toFixed(2) : rawAmount.toFixed(2);
  const currency = String((minPrice as Record<string, unknown>)?.currency || (minPrice as Record<string, unknown>)?.currencyCode || p.currency || "USD");

  // Extract variant (Shopify MCP returns variants[] per offer)
  const firstVariant = Array.isArray(p.variants) ? (p.variants as Array<Record<string, unknown>>)[0] : null;
  const firstProduct = Array.isArray(p.products) ? (p.products as Array<Record<string, unknown>>)[0] : null;

  // Extract image — prefer variant media, then offer-level media
  const variantMedia = firstVariant?.media as Array<Record<string, unknown>> | undefined;
  const offerMedia = (p.media || p.images) as Array<Record<string, unknown>> | undefined;
  const firstMedia = (Array.isArray(variantMedia) && variantMedia.length > 0)
    ? variantMedia[0]
    : Array.isArray(offerMedia) ? offerMedia[0] : null;
  const featuredImage = firstProduct?.featuredImage as Record<string, unknown> | undefined;
  const image = String(
    firstMedia?.url || featuredImage?.url || p.image || p.imageUrl || ""
  );

  // checkoutUrl — variants[0].checkoutUrl is the real merchant cart URL with Shop Pay
  const checkoutUrl = String(
    firstVariant?.checkoutUrl || firstProduct?.checkoutUrl || p.checkoutUrl || p.checkout_url || p.lookupUrl || "#"
  );

  // Extract rating — Shopify returns { rating: 4.8, count: 124 }
  const ratingObj = p.rating as Record<string, unknown> | undefined;
  const rating = Number(ratingObj?.rating || ratingObj?.value || p.rating || 0);

  // Extract vendor — prefer variant shop, then offer-level
  const shop = (firstVariant?.shop || firstProduct?.shop || p.shop) as Record<string, unknown> | undefined;
  const vendor = String(shop?.name || p.vendor || "");

  const description = String(p.description || "").slice(0, 300);
  const ratingCount = Number(ratingObj?.count || ratingObj?.reviewCount || 0);

  return {
    id: String(p.id || p.offer_id || p.offerId || ""),
    title: String(p.title || p.name || "Unknown Product"),
    price: priceInDollars,
    currency,
    image,
    rating,
    ratingCount,
    checkoutUrl,
    vendor,
    description: description || undefined,
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
