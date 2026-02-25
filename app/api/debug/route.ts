import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {
    env: {
      shopifyClientId: process.env.SHOPIFY_CLIENT_ID ? "SET" : "MISSING",
      shopifySecret: process.env.SHOPIFY_CLIENT_SECRET ? "SET" : "MISSING",
      googleApiKey: process.env.GOOGLE_API_KEY ? "SET" : "MISSING",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    },
  };

  // Test Shopify token
  try {
    const tokenRes = await fetch("https://api.shopify.com/auth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });
    const tokenData = await tokenRes.json();
    results.tokenFetch = tokenRes.ok ? "OK" : `FAIL ${tokenRes.status}`;
    results.tokenPreview = tokenData.access_token
      ? tokenData.access_token.slice(0, 20) + "..."
      : tokenData;

    // Test MCP search
    if (tokenData.access_token) {
      const mcpRes = await fetch(
        "https://discover.shopifyapps.com/global/mcp",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/call",
            id: 1,
            params: {
              name: "search_global_products",
              arguments: {
                query: "running shoes",
                context: "buyer",
                limit: 1,
              },
            },
          }),
        }
      );
      const mcpData = await mcpRes.json();
      results.mcpFetch = mcpRes.ok ? "OK" : `FAIL ${mcpRes.status}`;
      const content = mcpData?.result?.content?.[0];
      results.mcpContent = content
        ? `type=${content.type}, text=${typeof content.text === "string" ? content.text.slice(0, 100) : typeof content.text}`
        : mcpData;
    }
  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(results);
}
