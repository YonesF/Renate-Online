import { eskalering } from "@/lib/config";
import type { EskaleringForespørsel } from "@/lib/protocol";
import { klientIp, sjekkRateLimit } from "@/lib/rate-limit";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/eskaler – lager en sak til Renate med ferdig oppsummering:
 * utstyr, hva kunden har prøvd og hele samtalen. Kunden slipper å forklare alt på nytt.
 *
 * Prototype: saken lagres i Supabase (hvis satt opp) og sendes på e-post via Resend
 * (hvis nøkkel er satt). Uten noe av dette skrives den til serverloggen.
 */
export async function POST(req: Request) {
  if (!sjekkRateLimit(klientIp(req))) {
    return Response.json({ feil: "For mange forespørsler." }, { status: 429 });
  }

  let body: EskaleringForespørsel;
  try {
    body = (await req.json()) as EskaleringForespørsel;
  } catch {
    return Response.json({ feil: "Ugyldig forespørsel." }, { status: 400 });
  }

  const navn = String(body.navn ?? "").trim().slice(0, 100);
  const epost = String(body.epost ?? "").trim().slice(0, 200);
  if (!navn || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost)) {
    return Response.json({ feil: "Skriv inn navn og en gyldig e-postadresse." }, { status: 400 });
  }

  const saksnummer = `CA-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const provd = (body.provd ?? []).slice(0, 30).map((p) => String(p).slice(0, 300));
  const samtale = (body.samtale ?? []).slice(-20).map((m) => ({
    rolle: m.rolle === "kunde" ? "kunde" : "assistent",
    tekst: String(m.tekst).slice(0, 2000),
  }));
  const beskrivelse = String(body.beskrivelse ?? "").trim().slice(0, 2000);

  const oppsummering = [
    `Sak ${saksnummer}`,
    `Kunde: ${navn} <${epost}>`,
    `Printer: ${body.utstyr?.printer ?? "ikke oppgitt"}`,
    `Blekk: ${body.utstyr?.blekk ?? "ikke oppgitt"}`,
    beskrivelse && `\nKundens beskrivelse:\n${beskrivelse}`,
    provd.length ? `\nHar allerede prøvd:\n${provd.map((p) => `• ${p}`).join("\n")}` : "",
    `\nSamtale med assistenten:\n${samtale.map((m) => `${m.rolle === "kunde" ? "Kunde" : "Bot"}: ${m.tekst}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const db = supabase();
  if (db) {
    const { error } = await db.from("saker").insert({
      saksnummer,
      navn,
      epost,
      printer: body.utstyr?.printer,
      blekk: body.utstyr?.blekk,
      oppsummering,
      provd,
      samtale,
    });
    if (error) console.error("[eskaler] kunne ikke lagre sak:", error.message);
  }

  if (eskalering.resendKey && eskalering.til) {
    const svar = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${eskalering.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: eskalering.fra,
        to: eskalering.til,
        reply_to: epost,
        subject: `Ny sak fra Renate Online: ${saksnummer} (${body.utstyr?.printer ?? "ukjent printer"})`,
        text: oppsummering,
      }),
    });
    if (!svar.ok) console.error("[eskaler] e-post feilet:", svar.status, await svar.text());
  }

  if (!db && !(eskalering.resendKey && eskalering.til)) {
    console.info("[eskaler] (prototype – ingen lagring konfigurert)\n" + oppsummering);
  }

  return Response.json({ saksnummer });
}
