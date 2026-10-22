import { sokemodus } from "@/lib/config";
import { sokLokalt } from "./local";
import { sokSupabase } from "./supabase";
import type { SokResultat, SokValg } from "./types";

export type { Kilde, SokResultat, Treff } from "./types";

/**
 * Ett søk for både hjelpesiden og chatboten («én kunnskapskilde, to innganger»).
 * Feiler Supabase eller embedding-tjenesten, faller vi tilbake til lokalt søk
 * i stedet for å vise kunden en feilmelding.
 */
export async function sok(sporring: string, valg: SokValg = {}): Promise<SokResultat> {
  if (sokemodus() === "supabase") {
    try {
      return await sokSupabase(sporring, valg);
    } catch (err) {
      console.error("[sok] Supabase-søk feilet, bruker lokalt søk:", err);
    }
  }
  return sokLokalt(sporring, valg);
}
