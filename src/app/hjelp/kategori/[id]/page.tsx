import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Kontaktboks } from "@/components/help/Kontaktboks";
import { IkonChevron, KategoriIkon } from "@/components/icons";
import { hentGuider, hentKategorier } from "@/lib/content";

export function generateStaticParams() {
  return hentKategorier()
    .filter((k) => !k.ekstern)
    .map((k) => ({ id: k.id }));
}

export async function generateMetadata({ params }: PageProps<"/hjelp/kategori/[id]">): Promise<Metadata> {
  const { id } = await params;
  const k = hentKategorier().find((x) => x.id === id);
  return k ? { title: k.navn } : {};
}

export default async function KategoriSide({ params }: PageProps<"/hjelp/kategori/[id]">) {
  const { id } = await params;
  const kategori = hentKategorier().find((k) => k.id === id && !k.ekstern);
  if (!kategori) notFound();
  const guider = hentGuider().filter((g) => g.kategori === id);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <nav aria-label="Brødsmuler" className="flex items-center gap-1 text-[14px]">
        <Link href="/hjelp" className="hover:text-ca-red">
          Hjelpesenter
        </Link>
        <IkonChevron className="size-4" />
        <span className="text-ca-ink">{kategori.navn}</span>
      </nav>

      <header className="mt-6 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-ca-red-tint text-ca-red">
          <KategoriIkon navn={kategori.ikon} className="size-7" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold">{kategori.navn}</h1>
          <p>{kategori.beskrivelse}</p>
        </div>
      </header>

      <ul className="mt-8 divide-y divide-ca-line rounded-ca border border-ca-line">
        {guider.map((g) => (
          <li key={g.slug}>
            <Link href={`/hjelp/${g.slug}`} className="group flex items-center gap-3 px-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ca-ink group-hover:text-ca-red">{g.tittel}</span>
                <span className="block text-[15px]">{g.sammendrag}</span>
              </span>
              <IkonChevron className="size-5 shrink-0 group-hover:text-ca-red" />
            </Link>
          </li>
        ))}
        {guider.length === 0 && <li className="px-4 py-4">Ingen guider i denne kategorien ennå.</li>}
      </ul>

      <div className="mt-10">
        <Kontaktboks />
      </div>
    </div>
  );
}
