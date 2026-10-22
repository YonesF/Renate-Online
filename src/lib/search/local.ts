import { lagChunks, type Chunk } from "@/lib/content";
import { tokeniser } from "./norsk";
import type { SokResultat, SokValg, Treff } from "./types";

/**
 * Lokalt søk (BM25) over Markdown-guidene. Brukes i prototypen og som reserve
 * hvis Supabase eller embedding-tjenesten er nede.
 */

type Indeks = {
  chunks: Chunk[];
  tokens: string[][];
  df: Map<string, number>;
  snittLengde: number;
};

let cache: Indeks | null = null;

function byggIndeks(): Indeks {
  const chunks = lagChunks();
  const tokens = chunks.map((c) =>
    tokeniser(
      // Tittel og overskrift teller ekstra. Nøkkelordene legges bare på guidens første del,
      // ellers blir vanlige ord som «striper» for vanlige til å skille guidene fra hverandre.
      (c.id.endsWith("#0")
        ? [c.tittel, c.tittel, c.tittel, c.nokkelord.join(" "), c.tekst]
        : [c.tittel, c.overskrift, c.overskrift, c.tekst]
      ).join(" "),
    ),
  );
  const df = new Map<string, number>();
  for (const t of tokens) for (const ord of new Set(t)) df.set(ord, (df.get(ord) ?? 0) + 1);
  const snittLengde = tokens.reduce((s, t) => s + t.length, 0) / Math.max(tokens.length, 1);
  return { chunks, tokens, df, snittLengde };
}

function indeks(): Indeks {
  // I utvikling bygges indeksen på nytt hver gang, så endringer i guidene vises med en gang.
  if (!cache || process.env.NODE_ENV !== "production") cache = byggIndeks();
  return cache;
}

export function sokLokalt(sporring: string, valg: SokValg = {}): SokResultat {
  const { chunks, tokens, df, snittLengde } = indeks();
  const qTokens = [...new Set(tokeniser(sporring))];
  const N = chunks.length;
  const k1 = 1.4;
  const b = 0.75;

  const scored = chunks.map((chunk, i) => {
    const doc = tokens[i];
    const tf = new Map<string, number>();
    for (const o of doc) tf.set(o, (tf.get(o) ?? 0) + 1);
    let score = 0;
    let treffOrd = 0;
    for (const q of qTokens) {
      const f = tf.get(q) ?? 0;
      if (!f) continue;
      treffOrd++;
      const idf = Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / snittLengde)));
    }
    if (valg.printer && chunk.printere.some((p) => p.toLowerCase() === valg.printer!.toLowerCase())) {
      score *= 1.2;
    }
    return { chunk, score, dekning: qTokens.length ? treffOrd / qTokens.length : 0 };
  });

  // Maks to biter per guide, så kildene ikke blir fem utdrag fra samme side.
  const perGuide = new Map<string, number>();
  const valgte = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((s) => {
      const n = perGuide.get(s.chunk.slug) ?? 0;
      perGuide.set(s.chunk.slug, n + 1);
      return n < 2;
    })
    .slice(0, valg.antall ?? 5);

  const treff: Treff[] = valgte.map(({ chunk, score }) => ({
    slug: chunk.slug,
    tittel: chunk.tittel,
    kategori: chunk.kategori,
    overskrift: chunk.overskrift,
    tekst: chunk.tekst,
    utdrag: lagUtdrag(chunk.tekst),
    url: `/hjelp/${chunk.slug}`,
    score,
  }));

  const best = valgte[0];
  const sikker = !!best && best.dekning >= 0.34 && best.score > 1.0;
  return { treff, sikker, modus: "lokal" };
}

export function lagUtdrag(tekst: string, maks = 160): string {
  const flat = tekst.replace(/\s+/g, " ").trim();
  return flat.length > maks ? `${flat.slice(0, maks).replace(/\s\S*$/, "")} …` : flat;
}
