import { cohere } from "@ai-sdk/cohere";
import { rerank } from "ai";
import { embedSporring } from "@/lib/ai";
import { rerankConfig } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { lagUtdrag } from "./local";
import type { SokResultat, SokValg, Treff } from "./types";

type Rad = {
  id: string;
  slug: string;
  tittel: string;
  kategori: string;
  overskrift: string;
  tekst: string;
  printere: string[];
  likhet: number | null;
  score: number;
};

/** Hybrid-søk i Supabase (pgvector + norsk fulltekst), deretter reranking hvis Cohere-nøkkel finnes. */
export async function sokSupabase(sporring: string, valg: SokValg = {}): Promise<SokResultat> {
  const db = supabase();
  if (!db) throw new Error("Supabase er ikke konfigurert.");

  const embedding = await embedSporring(sporring);
  const { data, error } = await db.rpc("sok_hybrid", {
    query_text: sporring,
    query_embedding: embedding,
    match_count: 20,
  });
  if (error) throw error;

  let rader = (data ?? []) as Rad[];
  if (valg.printer) {
    const p = valg.printer.toLowerCase();
    rader = rader.filter((r) => r.printere.some((x) => x.toLowerCase() === "alle" || x.toLowerCase() === p));
  }

  const antall = valg.antall ?? 5;
  const rerankCfg = rerankConfig();
  let sikker: boolean;

  if (rerankCfg && rader.length > 0) {
    const { ranking } = await rerank({
      model: cohere.reranking(rerankCfg.model),
      query: sporring,
      documents: rader.map((r) => `${r.tittel} – ${r.overskrift}\n${r.tekst}`),
      topN: antall,
    });
    const sortert = ranking.map((r) => ({ ...rader[r.originalIndex], score: r.score }));
    // Terskelen må justeres med testsettet (se README → Evaluering).
    sikker = (ranking[0]?.score ?? 0) >= 0.25;
    rader = sortert;
  } else {
    rader = rader.slice(0, antall);
    sikker = (rader[0]?.likhet ?? 0) >= 0.45;
  }

  const treff: Treff[] = rader.map((r) => ({
    slug: r.slug,
    tittel: r.tittel,
    kategori: r.kategori,
    overskrift: r.overskrift,
    tekst: r.tekst,
    utdrag: lagUtdrag(r.tekst),
    url: `/hjelp/${r.slug}`,
    score: r.score,
  }));

  return { treff, sikker, modus: "supabase" };
}
