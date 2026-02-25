# KaoMart — CLAUDE.md

## Project Overview
KaoMart is an **agentic shopping demo** built with:
- **Next.js 14** (App Router) + Tailwind CSS
- **Gemini 2.5 Pro** (AI model with function calling)
- **Shopify Catalog MCP** (global product search — `discover.shopifyapps.com/global/mcp`)
- **Supabase** (conversation session + message history)
- **Vercel** (deployment)

## User Flow
1. User types natural language shopping query (e.g., "I want running shoes under $150")
2. Gemini understands intent → calls `search_global_products` tool
3. UI renders 1-3 product cards (image, name, price, rating, "Buy Now" button)
4. "Buy Now" → opens `checkoutUrl` in new tab → Shopify native checkout

## Credentials & Secrets

### Shopify Catalog MCP
```
SHOPIFY_CLIENT_ID=11d81b58f9f8d87a9db82224ccf998bf
SHOPIFY_CLIENT_SECRET=<set in .env.local>
```
Token endpoint: `POST https://api.shopify.com/auth/access_token`
```json
{ "client_id": "...", "client_secret": "...", "grant_type": "client_credentials" }
```
Returns `{ "access_token": "..." }` — valid for 1 hour.

MCP endpoint: `POST https://discover.shopifyapps.com/global/mcp`
Headers: `Authorization: Bearer {token}`, `Content-Type: application/json`

### Gemini (Google Vertex AI)
```
GOOGLE_API_KEY=AQ.Ab8RN6KJK9L-sR2FIEXMQuMp8Tcco4Y4ybKrTPQa--nRQsp32A
GOOGLE_PROJECT_ID=focal-welder-485422-s2
```
Use `gemini-2.5-pro` model.
REST endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key={API_KEY}`

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://zefonpsxqxvokunjnsyj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZm9ucHN4cXh2b2t1bmpuc3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDA4MzAsImV4cCI6MjA4NzYxNjgzMH0.bQWDc8jVH85I-NIf_nGDajIiifwTujmbJf2Cqerfhd4
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZm9ucHN4cXh2b2t1bmpuc3lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA0MDgzMCwiZXhwIjoyMDg3NjE2ODMwfQ.Lqh0McBzTRj2T07tx6hSaOrAOitysN_Tt0eyFdS65ug
```

### Vercel
```
VERCEL_TOKEN=LWCVBzsqeY43S6RjtGJy387h
```
Deploy: `vercel --token LWCVBzsqeY43S6RjtGJy387h --yes`

### GitHub
Push to: `https://github.com/wukao1985/kaomart` (create if doesn't exist)
Git credentials configured in `~/.git-credentials`.

## Database Schema (run on Supabase)

```sql
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  product_results jsonb,
  created_at timestamptz default now()
);

create index on messages(session_id, created_at);
```

Run via: `SUPABASE_ACCESS_TOKEN=sbp_d156e64470538d5055eee377de0ea9a81dd24ef7 npx supabase@latest db execute --project-ref zefonpsxqxvokunjnsyj --sql "..."`

Or use the Supabase JS client in a migration script.

## Shopify MCP Tool Calls

### search_global_products
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "search_global_products",
    "arguments": {
      "query": "running shoes under $150",
      "context": "buyer looking for athletic footwear",
      "limit": 3
    }
  }
}
```

### get_global_product_details
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 2,
  "params": {
    "name": "get_global_product_details",
    "arguments": {
      "offer_id": "gid://shopify/p/..."
    }
  }
}
```

## Gemini Function Definitions

Define these two tools for Gemini:
1. `search_products(query: string, context: string, limit?: number)` → calls Shopify MCP `search_global_products`
2. `get_product_details(offer_id: string)` → calls Shopify MCP `get_global_product_details`

## UI Requirements
- Full-screen chat interface (dark or light, your choice — make it look clean and premium)
- Messages: user bubbles right, assistant bubbles left
- Product cards rendered inline in the chat when Gemini returns results:
  - Product image (thumbnail ~120px)
  - Title + price + rating stars
  - "Buy Now" button → opens `checkoutUrl` in new tab
- Streaming text response from Gemini
- New session on page load, session_id stored in localStorage

## Acceptance Criteria
- [ ] `npm run build` passes with zero errors
- [ ] Typing "I want running shoes under $100" → 3 product cards appear in chat
- [ ] "Buy Now" on any product → opens valid Shopify checkout URL
- [ ] Messages persisted to Supabase `messages` table
- [ ] `vercel deploy` succeeds → live URL accessible
- [ ] Shopify token auto-refreshes when expired (handle 401 → re-fetch token)

## Important Notes
- Token caching: cache Shopify JWT in memory (or a module-level variable), refresh when expired
- Do NOT store secrets in client-side code — all Shopify/Gemini calls go through Next.js API routes
- Streaming: use `ReadableStream` for Gemini responses, pipe to frontend with `text/event-stream`
- Error handling: if search returns no results, Gemini should say so naturally
