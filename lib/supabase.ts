import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function createSession(): Promise<string> {
  const { data, error } = await supabase
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
  const { error } = await supabase.from("messages").insert({
    session_id: sessionId,
    role,
    content,
    product_results: productResults ?? null,
  });
  if (error) throw error;
}

export async function getMessages(sessionId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
