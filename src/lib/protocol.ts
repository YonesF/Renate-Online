/**
 * Formatet mellom chat-widgeten og /api/chat. Svaret strømmes som NDJSON:
 * én JSON-hendelse per linje. Delt mellom klient og server.
 */

export type ChatMelding = { rolle: "kunde" | "assistent"; tekst: string };

export type ChatForespørsel = {
  meldinger: ChatMelding[];
  utstyr?: { printer?: string; blekk?: string };
};

export type KildeKort = {
  slug: string;
  tittel: string;
  overskrift: string;
  utdrag: string;
  url: string;
};

export type ChatHendelse =
  | { type: "kilder"; kilder: KildeKort[]; sikker: boolean }
  | { type: "tekst"; delta: string }
  | { type: "flyt"; id: string; tittel: string }
  | { type: "ferdig"; modus: "demo" | "ki"; foreslaRenate: boolean }
  | { type: "feil"; melding: string };

export type EskaleringForespørsel = {
  navn: string;
  epost: string;
  beskrivelse?: string;
  utstyr?: { printer?: string; blekk?: string };
  provd: string[];
  samtale: ChatMelding[];
};
