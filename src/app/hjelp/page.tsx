import Link from "next/link";
import { HjelpSok } from "@/components/help/HjelpSok";
import { Kontaktboks } from "@/components/help/Kontaktboks";
import { IkonChevron, KategoriIkon } from "@/components/icons";
import { hentGuider, hentKategorier } from "@/lib/content";

export const metadata = { title: "Hjelpesenter" };

export default function HjelpForside() {
  const kategorier = hentKategorier();
  const guider = hentGuider();
  const populaere = guider.filter((g) => g.populaer);
  const antallPerKategori = (id: string) => guider.filter((g) => g.kategori === id).length;

  return (
    <>
      <section className="border-b border-ca-line bg-white px-4 pb-14 pt-12 text-center">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-semibold leading-tight">
          Hva trenger du hjelp med?
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[18px]">
          Finn raske svar, guider og tips til sublimeringsprinteren og de kreative prosjektene dine.
        </p>
        <div className="mt-7">
          <HjelpSok />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-12">
        <section aria-labelledby="kategorier">
          <h2 id="kategorier" className="font-display text-[22px] font-semibold">
            Kategorier
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {kategorier.map((k) => {
              const href = k.ekstern ?? `/hjelp/kategori/${k.id}`;
              const antall = antallPerKategori(k.id);
              return (
                <li key={k.id}>
                  <a
                    href={href}
                    className="group flex h-full flex-col items-center gap-2 rounded-ca border border-ca-line bg-white px-3 py-5 text-center transition-colors hover:border-ca-red"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-ca-red-tint text-ca-red">
                      <KategoriIkon navn={k.ikon} className="size-6" />
                    </span>
                    <span className="font-medium text-ca-ink group-hover:text-ca-red">{k.navn}</span>
                    <span className="text-[13px] leading-snug">
                      {k.ekstern ? "Side i nettbutikken" : `${antall} ${antall === 1 ? "guide" : "guider"}`}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <section aria-labelledby="populaere">
            <h2 id="populaere" className="font-display text-[22px] font-semibold">
              Populære spørsmål
            </h2>
            <ul className="mt-4 divide-y divide-ca-line rounded-ca border border-ca-line bg-white">
              {populaere.map((g) => (
                <li key={g.slug}>
                  <Link href={`/hjelp/${g.slug}`} className="group flex items-center gap-3 px-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ca-ink group-hover:text-ca-red">{g.tittel}</span>
                      <span className="line-clamp-1 block text-[14px]">{g.sammendrag}</span>
                    </span>
                    <IkonChevron className="size-5 shrink-0 text-ca-text group-hover:text-ca-red" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <div className="lg:pt-11">
            <Kontaktboks />
          </div>
        </div>
      </div>
    </>
  );
}
