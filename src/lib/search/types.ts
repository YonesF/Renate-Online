export type Kilde = {
  slug: string;
  tittel: string;
  kategori: string;
  overskrift: string;
  utdrag: string;
  url: string;
};

export type Treff = Kilde & {
  tekst: string;
  score: number;
};

export type SokResultat = {
  treff: Treff[];
  /** false = kunnskapsbasen har trolig ikke svaret. Da skal boten si fra og tilby Renate. */
  sikker: boolean;
  modus: "lokal" | "supabase";
};

export type SokValg = {
  antall?: number;
  printer?: string;
};
