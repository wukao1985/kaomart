import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export async function createSession(): Promise<string> {
  const { data, error } = await getSupabase()
    .from("sessions")
    .insert({})
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  productResults?: unknown
) {
  const { error } = await getSupabase().from("messages").insert({
    session_id: sessionId,
    role,
    content,
    product_results: productResults ?? null,
  });
  if (error) throw error;
}

export async function getMessages(sessionId: string) {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
