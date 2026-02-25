# KaoMart Implementation Plan

## Phase 0: Cleanup & Project Initialization

### 0.1 Remove broken scaffolding
- Delete `app/{api` directory tree (curly braces in folder names are invalid)
- Ensure clean `app/`, `components/`, `lib/`, `tasks/` directories remain

### 0.2 Initialize Next.js 14 project
**Files to create/generate:**
- `package.json` — dependencies: `next@14`, `react@18`, `react-dom@18`, `tailwindcss`, `postcss`, `autoprefixer`, `@supabase/supabase-js`
- `tsconfig.json` — strict mode, paths alias `@/*` → `./*`
- `next.config.js` — configure `images.remotePatterns` for Shopify CDN (`cdn.shopify.com`)
- `tailwind.config.ts` — content paths for `app/`, `components/`
- `postcss.config.js` — tailwindcss + autoprefixer
- `.gitignore` — node_modules, .next, .env.local
- `.env.local` — all secrets (Shopify, Gemini, Supabase keys)

**Commands:**
```bash
npm install
```

### 0.3 Create `.env.local`
```
SHOPIFY_CLIENT_ID=11d81b58f9f8d87a9db82224ccf998bf
SHOPIFY_CLIENT_SECRET=<set in .env.local>
GOOGLE_API_KEY=<from CLAUDE.md>
NEXT_PUBLIC_SUPABASE_URL=https://zefonpsxqxvokunjnsyj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from CLAUDE.md>
SUPABASE_SERVICE_ROLE_KEY=<from CLAUDE.md>
```

---

## Phase 1: Database Schema Setup

### 1.1 Run Supabase migration
Execute the SQL from CLAUDE.md against the Supabase project:
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

**Method:** Use the Supabase CLI command from CLAUDE.md with `SUPABASE_ACCESS_TOKEN`.

---

## Phase 2: Library Files (server-side only)

### 2.1 `lib/supabase.ts`
- Export `createClient()` using `@supabase/supabase-js`
- Server client uses `SUPABASE_SERVICE_ROLE_KEY` for write operations
- Browser client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` for read (session creation)
- TypeScript types for `Session` and `Message` matching the DB schema

### 2.2 `lib/shopify.ts`
- Module-level token cache: `{ accessToken: string; expiresAt: number }`
- `getShopifyToken()` — fetches from `https://api.shopify.com/auth/access_token` using client credentials, caches result, refreshes when expired or on 401
- `searchProducts(query: string, context: string, limit?: number)` — calls Shopify MCP endpoint (`POST https://discover.shopifyapps.com/global/mcp`) with JSON-RPC body for `search_global_products`
- `getProductDetails(offerId: string)` — calls Shopify MCP endpoint with JSON-RPC body for `get_global_product_details`
- Auto-retry on 401: invalidate cached token → re-fetch → retry once
- Returns parsed product data (title, price, image, rating, checkoutUrl)

### 2.3 `lib/gemini.ts`
- `streamGeminiResponse(messages: Message[], onToolCall: callback)` — calls Gemini REST API with streaming
- Gemini function declarations for the two tools:
  1. `search_products(query, context, limit)` → triggers `searchProducts()` from shopify.ts
  2. `get_product_details(offer_id)` → triggers `getProductDetails()` from shopify.ts
- System prompt: "You are KaoMart, a helpful shopping assistant. When users ask about products, use the search_products tool. Present results conversationally."
- Handle the Gemini streaming response format (chunked JSON with `candidates[].content.parts[]`)
- Handle `functionCall` parts → execute tool → send `functionResponse` back to Gemini → continue streaming
- Returns a `ReadableStream` of text chunks + product data markers

### 2.4 `lib/types.ts`
- `Product` type: `{ id, title, price, currency, image, rating, checkoutUrl, vendor }`
- `ChatMessage` type: `{ id, role, content, productResults?, createdAt }`
- `StreamEvent` type: `{ type: 'text' | 'products' | 'done' | 'error', data: string }`

---

## Phase 3: API Routes

### 3.1 `app/api/chat/route.ts`
- `POST` handler — receives `{ message: string, sessionId: string }`
- Creates session in Supabase if first message (or verifies session exists)
- Saves user message to `messages` table
- Builds conversation history from Supabase for context
- Calls `streamGeminiResponse()` with conversation history
- Streams response as `text/event-stream` (SSE format)
- Each SSE event: `data: {"type":"text","data":"..."}` or `data: {"type":"products","data":[...]}`
- On stream complete: saves assistant message + product_results to Supabase
- Returns streaming `Response` with appropriate headers

### 3.2 `app/api/session/route.ts`
- `POST` handler — creates a new session row in Supabase, returns `{ sessionId: uuid }`
- `GET` handler (optional) — fetch session messages for history reload

---

## Phase 4: UI Components

### 4.1 `app/layout.tsx`
- Root layout with Tailwind globals
- `<html>` + `<body>` with dark theme base styles
- Font: Inter or system font stack
- Meta tags, title "KaoMart"

### 4.2 `app/globals.css`
- Tailwind directives (`@tailwind base/components/utilities`)
- Custom scrollbar styling for chat area
- Any animation keyframes (fade-in for messages)

### 4.3 `app/page.tsx`
- Main chat page (client component: `"use client"`)
- State: `messages[]`, `sessionId`, `isLoading`, `input`
- On mount: call `POST /api/session` → store sessionId in localStorage (or use existing)
- On submit: add user message to state → call `POST /api/chat` → read SSE stream → append text chunks to assistant message → render product cards when products arrive
- Auto-scroll to bottom on new messages

### 4.4 `components/ChatMessage.tsx`
- Renders a single message bubble
- User messages: right-aligned, colored bubble
- Assistant messages: left-aligned, with avatar/icon
- If `productResults` present, renders `<ProductCard>` components inline

### 4.5 `components/ProductCard.tsx`
- Product image (120px thumbnail, use `next/image` with Shopify CDN domain)
- Product title (truncated if long)
- Price display (formatted with currency)
- Star rating (filled/empty stars based on rating value)
- "Buy Now" button → `window.open(checkoutUrl, '_blank')`
- Card styling: rounded, shadow, hover effect

### 4.6 `components/ChatInput.tsx`
- Fixed bottom input bar
- Text input + send button
- Disabled state while loading (shows typing indicator)
- Submit on Enter key

---

## Phase 5: Integration & Wiring

### 5.1 SSE stream parsing on the client
- In `page.tsx`, use `fetch()` with streaming response
- Read with `response.body.getReader()` + `TextDecoder`
- Parse SSE `data:` lines → update message state in real-time
- Handle `type: "products"` events → parse product JSON → attach to current message

### 5.2 Gemini tool-call loop (server-side)
- In `lib/gemini.ts`, implement the multi-turn tool call flow:
  1. Send user message + tool declarations to Gemini (streaming)
  2. If response contains `functionCall` → pause stream → execute Shopify tool → collect result
  3. Send `functionResponse` back to Gemini → resume streaming
  4. Gemini generates natural language response incorporating product data
  5. Forward both text and structured product data to the SSE stream

### 5.3 End-to-end data flow
```
User input → POST /api/chat → build history → Gemini stream
  → Gemini calls search_products → Shopify MCP → products returned
  → Gemini gets functionResponse → generates text with product context
  → SSE stream → client renders text + ProductCards
  → Save to Supabase
```

---

## Phase 6: Polish & Error Handling

### 6.1 Shopify token auto-refresh
- On any 401 from Shopify MCP: clear cached token → fetch new token → retry request once
- Log token refresh events server-side

### 6.2 Error states
- Network errors → show "Something went wrong, please try again" in chat
- Empty search results → Gemini says "I couldn't find products matching..." naturally
- Supabase errors → log server-side, don't break the chat

### 6.3 Loading states
- Typing indicator (animated dots) while waiting for Gemini response
- Skeleton cards while products are loading (optional)

---

## Phase 7: Build Verification & Deploy

### 7.1 Build check
```bash
npm run build
```
Must pass with zero errors.

### 7.2 Local testing
```bash
npm run dev
```
- Test: "I want running shoes under $100" → product cards appear
- Test: "Buy Now" → opens Shopify checkout URL
- Test: Check Supabase `messages` table for persisted data

### 7.3 Git setup & push
```bash
git init
git remote add origin https://github.com/wukao1985/kaomart.git
git add .
git commit -m "Initial KaoMart implementation"
git push -u origin main
```

### 7.4 Deploy to Vercel
```bash
npx vercel --token LWCVBzsqeY43S6RjtGJy387h --yes
```
- Set environment variables on Vercel (all from .env.local)
- Verify live URL is accessible and functional

---

## File Creation Order (dependency-based)

| Order | File | Depends On |
|-------|------|------------|
| 1 | `package.json` | — |
| 2 | `tsconfig.json` | — |
| 3 | `next.config.js` | — |
| 4 | `tailwind.config.ts` | — |
| 5 | `postcss.config.js` | — |
| 6 | `.gitignore` | — |
| 7 | `.env.local` | — |
| 8 | **`npm install`** | package.json |
| 9 | **Run Supabase migration** | — |
| 10 | `lib/types.ts` | — |
| 11 | `lib/supabase.ts` | types.ts |
| 12 | `lib/shopify.ts` | types.ts |
| 13 | `lib/gemini.ts` | shopify.ts, types.ts |
| 14 | `app/api/session/route.ts` | supabase.ts |
| 15 | `app/api/chat/route.ts` | gemini.ts, supabase.ts, shopify.ts |
| 16 | `app/globals.css` | tailwind.config.ts |
| 17 | `app/layout.tsx` | globals.css |
| 18 | `components/ProductCard.tsx` | types.ts |
| 19 | `components/ChatMessage.tsx` | ProductCard.tsx, types.ts |
| 20 | `components/ChatInput.tsx` | — |
| 21 | `app/page.tsx` | ChatMessage, ChatInput, types.ts |
| 22 | **`npm run build`** | all above |
| 23 | **Local test** | build passing |
| 24 | **Git push** | tests passing |
| 25 | **Vercel deploy** | git pushed |

---

## Acceptance Criteria Checklist

- [ ] `npm run build` passes with zero errors
- [ ] Typing "I want running shoes under $100" → 3 product cards appear in chat
- [ ] "Buy Now" on any product → opens valid Shopify checkout URL
- [ ] Messages persisted to Supabase `messages` table
- [ ] `vercel deploy` succeeds → live URL accessible
- [ ] Shopify token auto-refreshes when expired (handle 401 → re-fetch token)
