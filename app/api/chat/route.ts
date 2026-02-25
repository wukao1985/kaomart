import { NextRequest } from "next/server";
import { streamChat } from "@/lib/gemini";
import { saveMessage, getMessages } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || !sessionId) {
      return new Response(
        JSON.stringify({ error: "message and sessionId required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save user message
    await saveMessage(sessionId, "user", message);

    // Build conversation history
    const dbMessages = await getMessages(sessionId);
    const history = dbMessages.map(
      (m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })
    );

    // Stream response via SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendEvent(type: string, data: unknown) {
          const event = JSON.stringify({ type, data });
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        }

        try {
          const { fullText, products } = await streamChat(
            history,
            (text) => sendEvent("text", text),
            (prods) => sendEvent("products", prods)
          );

          // Save assistant message with product results
          await saveMessage(
            sessionId,
            "assistant",
            fullText,
            products.length > 0 ? products : undefined
          );

          sendEvent("done", null);
        } catch (err) {
          console.error("Chat stream error:", err);
          sendEvent(
            "error",
            err instanceof Error ? err.message : "An error occurred"
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
