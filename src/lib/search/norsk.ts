/**
 * Enkel norsk tekstbehandling for det lokale søket: små bokstaver, stoppord,
 * en grov stemmer og noen synonymer kundene faktisk bruker.
 */

const STOPPORD = new Set(
  (
    "og i jeg det at en et den til er som på de med han av ikke der så var meg seg men ett har om vi min mitt ha hadde " +
    "hun nå over da ved fra du ut sin dem oss opp man kan hans hvor eller hva skal selv sjøl her alle vil bli ble blitt kunne inn når " +
    "være kom noen noe ville dere som deres kun ja etter ned skulle denne for deg si sine sitt mot å meget hvorfor dette disse uten hvordan " +
    "ingen din ditt blir samme hvilken hvilke sånn inni mellom vår hver hvem vors hvis både bare enn fordi før mange også slik vært " +
    "begge siden henne hennes la lage få får fått gjør gjøre gjorde hei hallo takk litt veldig mye helt"
  ).split(" "),
);

/** Ord kundene bruker → ord som står i guidene. */
const SYNONYMER: Record<string, string> = {
  stripete: "stripe",
  striper: "stripe",
  streker: "stripe",
  linjer: "stripe",
  banding: "stripe",
  tett: "tett",
  tette: "tett",
  tettet: "tett",
  tetter: "tett",
  dyse: "dyse",
  dyser: "dyse",
  dysene: "dyse",
  dysetest: "dysekontroll",
  dysesjekk: "dysekontroll",
  nozzle: "dysekontroll",
  rense: "rens",
  renser: "rens",
  rensing: "rens",
  rengjøring: "rens",
  rengjøre: "rens",
  vaske: "rens",
  farge: "farge",
  farger: "farge",
  fargene: "farge",
  blass: "blass",
  blasse: "blass",
  bleke: "blass",
  matte: "blass",
  blekket: "blekk",
  tank: "tank",
  tanken: "tank",
  påfylling: "blekkbytte",
  fylte: "blekkbytte",
  byttet: "blekkbytte",
  printeren: "printer",
  skriveren: "printer",
  skriver: "printer",
  ferie: "borte",
  sjekk: "kontroll",
  sjekke: "kontroll",
  sjekker: "kontroll",
  teste: "kontroll",
  test: "kontroll",
};

/** Sammensatte ord deles, så «dysekontroll» også treffer «dyse» og «kontroll». */
const FORLEDD = ["dyse", "blekk", "farge", "skrive", "rens", "test"];

export function stem(ord: string): string {
  if (SYNONYMER[ord]) return SYNONYMER[ord];
  if (ord.length <= 4) return ord;
  for (const suffiks of ["ene", "ane", "ere", "ert", "het", "er", "en", "et", "es", "e"]) {
    if (ord.endsWith(suffiks) && ord.length - suffiks.length >= 4) {
      const rot = ord.slice(0, -suffiks.length);
      return SYNONYMER[rot] ?? rot;
    }
  }
  return ord;
}

export function tokeniser(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .replace(/[^a-z0-9æøåäöé\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((o) => o.length > 1 && !STOPPORD.has(o))
    .flatMap((o) => {
      const forledd = FORLEDD.find((f) => o.startsWith(f) && o.length >= f.length + 4);
      return forledd ? [stem(o), stem(forledd), stem(o.slice(forledd.length))] : [stem(o)];
    });
}
