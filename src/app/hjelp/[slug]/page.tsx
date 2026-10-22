import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApneChat } from "@/components/help/ApneChat";
import { Kontaktboks } from "@/components/help/Kontaktboks";
import { IkonChevron, IkonSteg } from "@/components/icons";
import { guideTilHtml, hentGuide, hentGuider, hentKategorier } from "@/lib/content";

export function generateStaticParams() {
  return hentGuider().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/hjelp/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = hentGuide(slug);
  return guide ? { title: guide.tittel, description: guide.sammendrag } : {};
}

export default async function GuideSide({ params }: PageProps<"/hjelp/[slug]">) {
  const { slug } = await params;
  const guide = hentGuide(slug);
  if (!guide) notFound();

  const kategori = hentKategorier().find((k) => k.id === guide.kategori);
  const relaterte = hentGuider().filter((g) => g.kategori === guide.kategori && g.slug !== guide.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <nav aria-label="Brødsmuler" className="flex flex-wrap items-center gap-1 text-[14px]">
        <Link href="/hjelp" className="hover:text-ca-red">
          Hjelpesenter
        </Link>
        <IkonChevron className="size-4" />
        {kategori && (
          <>
            <Link href={`/hjelp/kategori/${kategori.id}`} className="hover:text-ca-red">
              {kategori.navn}
            </Link>
            <IkonChevron className="size-4" />
          </>
        )}
        <span className="text-ca-ink">{guide.tittel}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article>
          {guide.status === "eksempel" && (
            <p className="mb-4 inline-block rounded-ca border border-[#e0b34a] bg-[#fdf6e3] px-2.5 py-1 text-[13px] text-[#7a5a12]">
              Eksempelinnhold – må gjennomgås og godkjennes av Renate før lansering
            </p>
          )}
          <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.4rem)] font-semibold leading-tight">
            {guide.tittel}
          </h1>
          <p className="mt-3 text-[19px] leading-relaxed text-ca-ink/85">{guide.sammendrag}</p>
          {guide.oppdatert && <p className="mt-2 text-[14px]">Sist oppdatert {formaterDato(guide.oppdatert)}</p>}

          {guide.flyt && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-ca-panel border border-ca-line bg-ca-surface/60 p-4">
              <div className="flex items-start gap-3">
                <IkonSteg className="mt-0.5 size-6 shrink-0 text-ca-red" />
                <div>
                  <p className="font-bold text-ca-ink">Vil du heller bli guidet steg for steg?</p>
                  <p className="text-[15px]">Svar på noen korte spørsmål, så finner vi årsaken sammen.</p>
                </div>
              </div>
              <ApneChat
                flyt={guide.flyt}
                className="rounded-ca bg-ca-red px-4 py-2.5 font-medium text-white hover:bg-ca-red-dark"
              >
                Start feilsøking
              </ApneChat>
            </div>
          )}

          <div className="ca-prose mt-6" dangerouslySetInnerHTML={{ __html: guideTilHtml(guide) }} />
        </article>

        <aside className="space-y-6">
          {relaterte.length > 0 && (
            <section>
              <h2 className="font-display text-lg font-semibold">Relaterte guider</h2>
              <ul className="mt-3 divide-y divide-ca-line rounded-ca border border-ca-line">
                {relaterte.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/hjelp/${g.slug}`} className="block px-4 py-3 font-medium text-ca-ink hover:text-ca-red">
                      {g.tittel}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Kontaktboks />
        </aside>
      </div>
    </div>
  );
}

function formaterDato(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}
