"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { IkonBok, IkonChat, IkonSok } from "@/components/icons";
import { ApneChat } from "./ApneChat";

type Treff = { slug: string; tittel: string; overskrift: string; utdrag: string; url: string };

/**
 * Søkefeltet på hjelpesiden. Ser ut som søket på creativeart.no (rød ramme, rød knapp)
 * og bruker samme søk som chatboten via /api/sok.
 */
export function HjelpSok() {
  const [q, setQ] = useState("");
  const [treff, setTreff] = useState<Treff[] | null>(null);
  const [laster, setLaster] = useState(false);
  const listeId = useId();

  useEffect(() => {
    const sporring = q.trim();
    if (sporring.length < 2) return;
    const kontroller = new AbortController();
    const t = setTimeout(async () => {
      setLaster(true);
      try {
        const res = await fetch(`/api/sok?q=${encodeURIComponent(sporring)}`, { signal: kontroller.signal });
        const data = await res.json();
        setTreff(data.treff ?? []);
      } catch {
        /* avbrutt */
      } finally {
        setLaster(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      kontroller.abort();
    };
  }, [q]);

  const visTreff = q.trim().length >= 2 ? treff : null;

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="flex overflow-hidden rounded-ca border border-ca-red bg-white shadow-sm"
      >
        <label htmlFor="hjelp-sok" className="sr-only">
          Søk i hjelpesenteret
        </label>
        <input
          id="hjelp-sok"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk etter spørsmål eller problem, f.eks. «striper i utskriften»"
          autoComplete="off"
          aria-controls={listeId}
          className="h-14 min-w-0 flex-1 px-4 text-[17px] text-ca-ink outline-none placeholder:text-ca-text/80"
        />
        <button type="submit" className="grid w-14 place-items-center bg-ca-red text-white hover:bg-ca-red-dark" aria-label="Søk">
          <IkonSok className="size-6" />
        </button>
      </form>

      {visTreff !== null && (
        <div
          id={listeId}
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-ca-panel border border-ca-line bg-white text-left shadow-lg"
        >
          {visTreff.length > 0 ? (
            <ul className="divide-y divide-ca-line">
              {visTreff.map((t) => (
                <li key={t.slug}>
                  <Link href={t.url} className="flex gap-3 px-4 py-3 hover:bg-ca-surface/60">
                    <IkonBok className="mt-0.5 size-5 shrink-0 text-ca-red" />
                    <span className="min-w-0">
                      <span className="block font-medium text-ca-ink">{t.tittel}</span>
                      <span className="line-clamp-2 block text-[14px] text-ca-text">{t.utdrag}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            !laster && <p className="px-4 py-3 text-[15px]">Fant ingen guide som passer.</p>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-ca-line bg-ca-surface/60 px-4 py-2.5 text-[14px]">
            <span>Finner du ikke det du leter etter?</span>
            <ApneChat className="inline-flex items-center gap-1.5 font-medium text-ca-red hover:underline">
              <IkonChat className="size-4" /> Spør assistenten
            </ApneChat>
          </div>
        </div>
      )}
    </div>
  );
}
