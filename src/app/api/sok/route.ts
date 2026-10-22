import { klientIp, sjekkRateLimit } from "@/lib/rate-limit";
import { sok } from "@/lib/search";

/** GET /api/sok?q=... – søket på hjelpesiden. Samme søk som chatboten bruker. */
export async function GET(req: Request) {
  if (!sjekkRateLimit(klientIp(req))) {
    return Response.json({ feil: "For mange søk. Vent litt og prøv igjen." }, { status: 429 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 300) ?? "";
  if (q.length < 2) return Response.json({ treff: [], sikker: false });

  const resultat = await sok(q, { antall: 8 });
  const sett = new Set<string>();
  const treff = resultat.treff
    .filter((t) => (sett.has(t.slug) ? false : (sett.add(t.slug), true)))
    .map(({ slug, tittel, kategori, overskrift, utdrag, url }) => ({
      slug,
      tittel,
      kategori,
      overskrift,
      utdrag,
      url,
    }));

  return Response.json({ treff, sikker: resultat.sikker });
}
