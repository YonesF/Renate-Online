import Link from "next/link";
import type { ReactNode } from "react";
import { butikk } from "@/lib/config";

const LOGO =
  "https://creativeart.no/cdn/shop/files/creativeart_original-logo_liggende_fcc44919-af39-4ba7-98ce-0f796f7ef82e_500x.png?v=1711757760";

/**
 * Topp og bunn som etterligner creativeart.no, så hjelpesiden føles som en del av butikken
 * mens den kjører som egen app. Når hjelpesiden flyttes inn i Shopify-temaet, faller denne bort.
 */
export function Butikkramme({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-ca-red px-4 py-2 text-center text-[15px] text-white">
        Hjelpesenter for sublimeringsprintere – feilsøking, vedlikehold og veiledning
      </div>

      <header className="bg-ca-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <a href={butikk.url} className="shrink-0" aria-label="CreativeArt.no – til forsiden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="CreativeArt" className="h-10 w-auto sm:h-12" />
          </a>
          <nav className="flex items-center gap-5 text-[16px] text-ca-nav">
            <Link href="/hjelp" className="hover:text-ca-red">
              Hjelpesenter
            </Link>
            <a href={`${butikk.url}/collections/sublimering`} className="hidden hover:text-ca-red sm:inline">
              Sublimering
            </a>
            <a
              href={butikk.url}
              className="rounded-ca border-2 border-ca-grey bg-white px-3 py-1.5 text-ca-grey hover:border-ca-red hover:text-ca-red"
            >
              Til nettbutikken
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-ca-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 text-[15px] sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-semibold text-ca-ink">Vi er her for å hjelpe!</p>
            <p className="mt-1">Finner du ikke svaret, kan du alltid spørre Renate.</p>
          </div>
          <ul className="space-y-1.5">
            <li>
              <a href={`${butikk.url}/pages/kontakt`} className="hover:text-ca-red">
                Kontakt oss
              </a>
            </li>
            <li>
              <a href={`${butikk.url}/pages/kutteinstillinger`} className="hover:text-ca-red">
                Kutteinnstillinger
              </a>
            </li>
            <li>
              <a href={`${butikk.url}/pages/fraktbetingelser`} className="hover:text-ca-red">
                Fraktbetingelser
              </a>
            </li>
          </ul>
          <ul className="space-y-1.5">
            <li>
              <a href={butikk.messengerUrl} className="hover:text-ca-red">
                Messenger
              </a>
            </li>
            <li>
              <a href="https://creativeart.tv" className="hover:text-ca-red">
                YouTube
              </a>
            </li>
            <li>
              <a href={`${butikk.url}/policies/privacy-policy`} className="hover:text-ca-red">
                Personvernerklæring
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
