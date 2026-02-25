import { NextResponse } from "next/server";
import { createSession } from "@/lib/supabase";

export async function POST() {
  try {
    const sessionId = await createSession();
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
