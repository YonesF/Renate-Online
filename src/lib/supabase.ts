import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let klient: SupabaseClient | null = null;

/**
 * Supabase-klient med service role-nøkkel. Brukes KUN på serveren (API-ruter og scripts).
 * Nøkkelen må aldri havne i nettleseren eller i en NEXT_PUBLIC_-variabel.
 */
export function supabase(): SupabaseClient | null {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  klient ??= createClient(cfg.url, cfg.serviceKey, { auth: { persistSession: false } });
  return klient;
}
