/**
 * Indekserer guidene i /content/guider til Supabase (pgvector + fulltekst).
 *
 *   npm run indekser
 *
 * Krever SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY og en embedding-nøkkel (COHERE_API_KEY
 * eller OPENAI_API_KEY) i .env.local. Kjør på nytt hver gang guidene endres.
 * Senere kan dette kjøres automatisk (Vercel Cron / Shopify-webhook) når Renate endrer innhold.
 */
import { embedDokumenter } from "@/lib/ai";
import { embeddingConfig, supabaseConfig } from "@/lib/config";
import { lagChunks } from "@/lib/content";
import { supabase } from "@/lib/supabase";

async function main() {
  if (!supabaseConfig()) throw new Error("Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local");
  const emb = embeddingConfig();
  if (!emb) throw new Error("Mangler COHERE_API_KEY eller OPENAI_API_KEY i .env.local");
  const db = supabase()!;

  const chunks = lagChunks();
  console.log(`Fant ${chunks.length} biter i ${new Set(chunks.map((c) => c.slug)).size} guider.`);
  console.log(`Lager embeddings med ${emb.provider} / ${emb.model} …`);

  const BATCH = 48;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const del = chunks.slice(i, i + BATCH);
    const vektorer = await embedDokumenter(del.map((c) => `${c.tittel} – ${c.overskrift}\n${c.tekst}`));
    const { error } = await db.from("kunnskap_chunks").upsert(
      del.map((c, j) => ({
        id: c.id,
        slug: c.slug,
        tittel: c.tittel,
        kategori: c.kategori,
        overskrift: c.overskrift,
        tekst: c.tekst,
        printere: c.printere,
        nokkelord: c.nokkelord,
        embedding: vektorer[j],
        oppdatert: new Date().toISOString(),
      })),
    );
    if (error) throw error;
    console.log(`  ✓ ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }

  // Fjern biter fra guider som er slettet eller endret.
  const gyldige = new Set(chunks.map((c) => c.id));
  const { data: eksisterende, error } = await db.from("kunnskap_chunks").select("id");
  if (error) throw error;
  const foreldede = (eksisterende ?? []).map((r) => r.id as string).filter((id) => !gyldige.has(id));
  if (foreldede.length) {
    await db.from("kunnskap_chunks").delete().in("id", foreldede);
    console.log(`  🗑  Fjernet ${foreldede.length} gamle biter.`);
  }
  console.log("Ferdig.");
}

main().catch((err) => {
  console.error("Indeksering feilet:", err.message ?? err);
  process.exit(1);
});
