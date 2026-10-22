import fs from "node:fs";
import path from "node:path";

/**
 * Faste feilsøkingsflyter. Stegene er data skrevet av Creative Art, ikke tekst generert av KI,
 * slik at boten aldri kan «finne på» et steg (f.eks. å rense ti ganger på rad).
 */

export type FlytValg = { tekst: string; til: string };

export type FlytNode = {
  tekst: string;
  detaljer?: string[];
  guide?: string;
  valg?: FlytValg[];
  utfall?: "lost" | "eskaler";
};

export type Flyt = {
  id: string;
  tittel: string;
  beskrivelse: string;
  start: string;
  noder: Record<string, FlytNode>;
};

export function hentFlyter(): Flyt[] {
  const dir = path.join(process.cwd(), "content", "flyter");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Flyt);
}
