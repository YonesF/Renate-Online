"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const ingenEndring = () => () => {};

/**
 * Lager et bokmerke-script (bookmarklet) som legger chatboten inn på siden du står på.
 * Dra lenken til bokmerkelinjen, åpne creativeart.no og klikk bokmerket.
 * NB: creativeart.no krever HTTPS, så appen må kjøre på https (Vercel eller `npm run dev:https`).
 */
export function Bokmerke() {
  const ref = useRef<HTMLAnchorElement>(null);
  const origin = useSyncExternalStore(ingenEndring, () => window.location.origin, () => "");

  useEffect(() => {
    if (!origin) return;
    const o = origin;
    const kode = `javascript:(()=>{if(window.RenateOnline){window.RenateOnline.open();return}const s=document.createElement('script');s.src='${o}/embed.js?t='+Date.now();document.body.appendChild(s)})()`;
    // React blokkerer javascript:-lenker i href, så den settes direkte på elementet.
    ref.current?.setAttribute("href", kode);
  }, [origin]);

  const erHttps = origin.startsWith("https://");

  return (
    <div className="space-y-2">
      <a
        ref={ref}
        href="#"
        onClick={(e) => e.preventDefault()}
        className="inline-flex cursor-grab items-center gap-2 rounded-ca bg-ca-red px-4 py-2.5 font-medium text-white"
      >
        ⭐ Renate Online
      </a>
      <p className="text-[14px]">Dra knappen opp til bokmerkelinjen i nettleseren.</p>
      {origin && !erHttps && (
        <p className="rounded-ca border border-[#e0b34a] bg-[#fdf6e3] px-3 py-2 text-[14px] text-[#7a5a12]">
          Du kjører på <code>{origin}</code>. creativeart.no tvinger HTTPS og blokkerer skript fra http-adresser,
          så bokmerket virker bare der hvis appen kjører på https (Vercel-forhåndsvisning eller{" "}
          <code>npm run dev:https</code>).
        </p>
      )}
    </div>
  );
}
