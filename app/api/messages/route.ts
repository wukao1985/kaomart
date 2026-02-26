import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const messages = await getMessages(sessionId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Failed to load messages:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
