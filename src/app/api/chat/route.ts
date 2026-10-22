import { streamText } from "ai";
import { språkmodell } from "@/lib/ai";
import { grenser } from "@/lib/config";
import { hentGuider } from "@/lib/content";
import { hentFlyter } from "@/lib/flows";
import { loggUbesvart } from "@/lib/logg";
import { lagInstruksjoner } from "@/lib/prompt";
import type { ChatForespørsel, ChatHendelse } from "@/lib/protocol";
import { klientIp, sjekkRateLimit } from "@/lib/rate-limit";
import { sok, type Treff } from "@/lib/search";

/**
 * POST /api/chat
 * 1. Søker i kunnskapsbasen (samme søk som hjelpesiden).
 * 2. Sender kildene til widgeten med en gang.
 * 3. Strømmer svaret: fra språkmodellen hvis nøkkel er satt, ellers demo-svar rett fra guidene.
 */
export async function POST(req: Request) {
  if (!sjekkRateLimit(klientIp(req))) {
    return Response.json({ feil: "For mange forespørsler. Vent litt og prøv igjen." }, { status: 429 });
  }

  let body: ChatForespørsel;
  try {
    body = (await req.json()) as ChatForespørsel;
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel." }, { status: 400 });
  }

  const meldinger = (body.meldinger ?? [])
    .filter((m) => (m.rolle === "kunde" || m.rolle === "assistent") && typeof m.tekst === "string")
    .slice(-grenser.maksMeldingerIHistorikk)
    .map((m) => ({ ...m, tekst: m.tekst.slice(0, grenser.maksTegnPerMelding) }));

  const kundeMeldinger = meldinger.filter((m) => m.rolle === "kunde");
  const siste = kundeMeldinger.at(-1)?.tekst.trim();
  if (!siste) return Response.json({ feil: "Meldingen er tom." }, { status: 400 });

  const utstyr = body.utstyr ?? {};
  // De to siste kundemeldingene gir søket nok kontekst ved oppfølgingsspørsmål («det hjalp ikke»).
  const sporring = kundeMeldinger.slice(-2).map((m) => m.tekst).join(" ");
  const resultat = await sok(sporring, { antall: 4, printer: utstyr.printer });

  if (!resultat.sikker) {
    void loggUbesvart(siste, utstyr.printer, resultat.treff[0]?.tittel);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (h: ChatHendelse) => controller.enqueue(encoder.encode(JSON.stringify(h) + "\n"));

      try {
        // Samme rekkefølge som i instruksjonen, så kildehenvisningen [1], [2] … peker riktig.
        // Widgeten viser én kort per guide, og bare når treffet er sikkert.
        send({
          type: "kilder",
          sikker: resultat.sikker,
          kilder: resultat.treff.map(({ slug, tittel, overskrift, utdrag, url }) => ({
            slug,
            tittel,
            overskrift,
            utdrag,
            url,
          })),
        });

        const flyt = resultat.sikker ? finnFlyt(resultat.treff) : null;
        const modell = språkmodell();
        let modellFeil: unknown = null;

        if (!resultat.sikker && resultat.treff.length === 0) {
          await strømTekst(
            send,
            "Jeg fant dessverre ikke noe om dette i Creative Arts guider, og jeg vil ikke gjette. " +
              "Vil du at jeg sender spørsmålet videre til Renate? Da får hun med det du har skrevet her.",
          );
          send({ type: "ferdig", modus: modell ? "ki" : "demo", foreslaRenate: true });
          return;
        }

        if (modell) {
          const result = streamText({
            model: modell,
            instructions: lagInstruksjoner(resultat.treff, resultat.sikker, utstyr),
            messages: meldinger.map((m) => ({
              role: m.rolle === "kunde" ? ("user" as const) : ("assistant" as const),
              content: m.tekst,
            })),
            maxOutputTokens: 600,
            temperature: 0.2,
            // Feil fra modellen kastes ikke av streamText, så de fanges her og sendes som feilmelding.
            onError: ({ error }) => {
              modellFeil = error;
            },
          });
          let fikkTekst = false;
          for await (const delta of result.textStream) {
            fikkTekst = true;
            send({ type: "tekst", delta });
          }
          if (modellFeil && !fikkTekst) throw modellFeil;
        } else {
          await strømTekst(send, demoSvar(resultat.treff, resultat.sikker));
        }

        if (flyt) send({ type: "flyt", id: flyt.id, tittel: flyt.tittel });
        send({ type: "ferdig", modus: modell ? "ki" : "demo", foreslaRenate: !resultat.sikker });
      } catch (err) {
        console.error("[chat]", err);
        send({
          type: "feil",
          melding: "Noe gikk galt hos oss. Prøv igjen, eller kontakt Renate på Messenger.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function finnFlyt(treff: Treff[]) {
  const guider = hentGuider();
  const flyter = hentFlyter();
  for (const t of treff.slice(0, 2)) {
    const id = guider.find((g) => g.slug === t.slug)?.flyt;
    const flyt = id && flyter.find((f) => f.id === id);
    if (flyt) return flyt;
  }
  return null;
}

/** Uten språkmodell: vis den mest relevante delen av guiden direkte. */
function demoSvar(treff: Treff[], sikker: boolean): string {
  const t = treff[0];
  const innledning = sikker
    ? `Dette fant jeg i guiden «${t.tittel}»:`
    : `Jeg er ikke helt sikker, men dette kan være relevant fra «${t.tittel}»:`;
  const tekst = t.tekst.length > 700 ? `${t.tekst.slice(0, 700).replace(/\s\S*$/, "")} …` : t.tekst;
  return `${innledning}\n\n${tekst}\n\nÅpne guiden under for hele forklaringen.`;
}

async function strømTekst(send: (h: ChatHendelse) => void, tekst: string) {
  const biter = tekst.match(/\S+\s*/g) ?? [tekst];
  for (const bit of biter) {
    send({ type: "tekst", delta: bit });
    await new Promise((r) => setTimeout(r, 12));
  }
}
