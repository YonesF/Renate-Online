/**
 * Mini-evaluering av søket. Kjør:  npm run test:sok
 *
 * Hver linje er et kundespørsmål og hvilke(n) guide(r) som er riktig øverst (null = boten skal si at den ikke vet).
 * Bytt ut og utvid med 40–50 anonymiserte spørsmål fra Renates Messenger-historikk.
 * Kjør dette hver gang dere endrer søk, guider eller modell – da ser dere om noe ble verre.
 */
import { sok } from "@/lib/search";

const TESTSETT: { sporsmal: string; forventet: string[] | null }[] = [
  { sporsmal: "printeren lager striper på koppene", forventet: ["stripete-utskrift", "tette-dyser"] },
  { sporsmal: "hvordan sjekker jeg dysene", forventet: ["dysekontroll"] },
  { sporsmal: "gult mangler helt etter at jeg fylte på blekk", forventet: ["etter-blekkbytte"] },
  { sporsmal: "fargene blir så blasse på t-skjorta", forventet: ["feil-farger"] },
  { sporsmal: "har renset 5 ganger og det hjelper ikke", forventet: ["tette-dyser"] },
  { sporsmal: "skal på ferie i tre uker, hva gjør jeg med printeren", forventet: ["vedlikehold"] },
  { sporsmal: "hva koster frakt til Bergen", forventet: null }, // skal IKKE gi sikkert treff
];

async function main() {
  let riktige = 0;
  for (const { sporsmal, forventet } of TESTSETT) {
    const r = await sok(sporsmal, { antall: 3 });
    const topp = r.sikker ? r.treff[0]?.slug ?? null : null;
    const ok = forventet === null ? topp === null : !!topp && forventet.includes(topp);
    if (ok) riktige++;
    console.log(`${ok ? "✓" : "✗"} «${sporsmal}» → ${topp ?? "(usikker – sendes til Renate)"}${ok ? "" : `  (forventet ${forventet?.join(" eller ") ?? "usikker"})`}`);
  }
  console.log(`\n${riktige}/${TESTSETT.length} riktige (${r(riktige / TESTSETT.length)} %)`);
}
const r = (x: number) => Math.round(x * 100);

main();
