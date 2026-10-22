import { supabase } from "./supabase";

/**
 * Forbedringssløyfen: spørsmål boten ikke fant svar på lagres, slik at Renate
 * kan skrive en ny guide for dem. Uten Supabase skrives de bare til serverloggen.
 */
export async function loggUbesvart(sporsmal: string, printer?: string, besteTreff?: string) {
  const db = supabase();
  if (!db) {
    console.info("[ubesvart]", { sporsmal, printer, besteTreff });
    return;
  }
  const { error } = await db
    .from("ubesvarte_sporsmal")
    .insert({ sporsmal: sporsmal.slice(0, 1000), printer, beste_treff: besteTreff });
  if (error) console.error("[ubesvart] kunne ikke lagre:", error.message);
}
