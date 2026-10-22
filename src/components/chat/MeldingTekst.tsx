import { Fragment, type ReactNode } from "react";
import type { KildeKort } from "@/lib/protocol";

/**
 * Viser botens svar med enkel formatering: avsnitt, nummererte og punktlister,
 * **fet skrift** og kildehenvisninger [1]. Lager React-elementer (ingen innerHTML).
 */
export function MeldingTekst({ tekst, kilder = [] }: { tekst: string; kilder?: KildeKort[] }) {
  const blokker: ReactNode[] = [];
  let liste: { type: "ol" | "ul"; punkter: string[] } | null = null;

  const tømListe = () => {
    if (!liste) return;
    const Tag = liste.type;
    blokker.push(
      <Tag
        key={blokker.length}
        className={`my-1.5 space-y-1 pl-5 ${Tag === "ol" ? "list-decimal" : "list-disc"} marker:text-ca-red`}
      >
        {liste.punkter.map((p, i) => (
          <li key={i}>{inline(p, kilder)}</li>
        ))}
      </Tag>,
    );
    liste = null;
  };

  for (const rå of tekst.split("\n")) {
    const linje = rå.trimEnd();
    const nummer = linje.match(/^\s*\d+[.)]\s+(.*)$/);
    const punkt = linje.match(/^\s*[-•*]\s+(.*)$/);
    if (nummer || punkt) {
      const type = nummer ? "ol" : "ul";
      if (liste && liste.type !== type) tømListe();
      liste ??= { type, punkter: [] };
      liste.punkter.push((nummer ?? punkt)![1]);
      continue;
    }
    tømListe();
    if (linje.trim() === "") continue;
    blokker.push(
      <p key={blokker.length} className="my-1.5 first:mt-0 last:mb-0">
        {inline(linje.replace(/^#+\s*/, ""), kilder)}
      </p>,
    );
  }
  tømListe();
  return <>{blokker}</>;
}

function inline(tekst: string, kilder: KildeKort[]): ReactNode {
  const deler = tekst.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return deler.map((del, i) => {
    if (/^\*\*[^*]+\*\*$/.test(del)) {
      return (
        <strong key={i} className="font-bold text-ca-ink">
          {del.slice(2, -2)}
        </strong>
      );
    }
    const ref = del.match(/^\[(\d+)\]$/);
    if (ref) {
      const kilde = kilder[Number(ref[1]) - 1];
      if (!kilde) return null;
      return (
        <a
          key={i}
          href={kilde.url}
          target="_blank"
          rel="noopener"
          title={kilde.tittel}
          className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-ca-red-tint px-1 align-text-top text-[11px] font-bold text-ca-red no-underline hover:bg-ca-red hover:text-white"
        >
          {ref[1]}
        </a>
      );
    }
    return <Fragment key={i}>{del}</Fragment>;
  });
}
