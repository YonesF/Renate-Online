import { grenser } from "./config";

/**
 * Enkel begrensning per IP (glidende vindu på ett minutt), så en bot ikke kan
 * bruke opp API-budsjettet. NB: Minnet deles ikke mellom Vercel-instanser.
 * I produksjon bør dette byttes til Upstash Ratelimit eller Vercel Firewall (se README).
 */
const logg = new Map<string, number[]>();

export function sjekkRateLimit(ip: string): boolean {
  const naa = Date.now();
  const vindu = (logg.get(ip) ?? []).filter((t) => naa - t < 60_000);
  if (vindu.length >= grenser.forespørslerPerMinutt) {
    logg.set(ip, vindu);
    return false;
  }
  vindu.push(naa);
  logg.set(ip, vindu);
  if (logg.size > 5000) logg.clear();
  return true;
}

export function klientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "ukjent"
  );
}
