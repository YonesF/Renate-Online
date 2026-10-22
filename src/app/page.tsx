import Link from "next/link";
import { Bokmerke } from "@/components/Bokmerke";
import { IkonBok, IkonChat, IkonPrinter } from "@/components/icons";
import { llmConfig, sokemodus, supabaseConfig } from "@/lib/config";
import { hentGuider } from "@/lib/content";

export const metadata = { title: "Renate Online – prototype", robots: { index: false } };

/** Startside for utviklerne: status og snarveier til alle delene av prototypen. */
export default function Start() {
  const llm = llmConfig();
  const status = [
    { navn: "Søk", verdi: sokemodus() === "supabase" ? "Supabase (hybrid)" : "Lokalt i Markdown-filene", ok: true },
    { navn: "Språkmodell", verdi: llm ? `${llm.provider} / ${llm.model}` : "Ingen nøkkel – demo-modus", ok: !!llm },
    { navn: "Database", verdi: supabaseConfig() ? "Supabase koblet til" : "Ikke satt opp (valgfritt)", ok: !!supabaseConfig() },
    { navn: "Guider", verdi: `${hentGuider().length} stk i content/guider`, ok: true },
  ];

  const lenker = [
    { href: "/hjelp", tittel: "Hjelpesenter", tekst: "Søk, kategorier og guider", Ikon: IkonBok },
    { href: "/widget", tittel: "Chat (alene)", tekst: "Chatten uten nettside rundt", Ikon: IkonChat },
    { href: "/demo.html", tittel: "Demo-butikk", tekst: "Testside med chatboblen lagt inn", Ikon: IkonPrinter },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-[14px] font-medium uppercase tracking-wide text-ca-red">Prototype · IS-219 Gruppe 15</p>
      <h1 className="mt-1 font-display text-4xl font-semibold">Renate Online</h1>
      <p className="mt-2 text-[18px]">
        Chatbot med RAG og hjelpesenter for CreativeArt.no. Én kunnskapsbase, to innganger.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {lenker.map(({ href, tittel, tekst, Ikon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col gap-2 rounded-ca border border-ca-line p-4 hover:border-ca-red"
            >
              <Ikon className="size-6 text-ca-red" />
              <span className="font-medium text-ca-ink">{tittel}</span>
              <span className="text-[14px]">{tekst}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Status</h2>
        <dl className="mt-3 divide-y divide-ca-line rounded-ca border border-ca-line">
          {status.map((s) => (
            <div key={s.navn} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-ca-ink">{s.navn}</dt>
              <dd className="flex items-center gap-2 text-right text-[15px]">
                <span className={`size-2 rounded-full ${s.ok ? "bg-ca-success" : "bg-[#e0b34a]"}`} aria-hidden />
                {s.verdi}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Test på den ekte nettsiden</h2>
        <p className="mt-1 mb-4">
          Bokmerket legger chatboblen inn på creativeart.no i <em>din</em> nettleser. Ingen andre ser det, og
          ingenting i butikken endres.
        </p>
        <Bokmerke />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Integrasjon hos Renate</h2>
        <p className="mt-1">Én linje i Shopify-temaet (bytt ut adressen med Vercel-adressen):</p>
        <pre className="mt-3 overflow-x-auto rounded-ca bg-ca-ink p-4 text-[14px] text-white">
          {`<script src="https://DIN-APP.vercel.app/embed.js" defer></script>`}
        </pre>
      </section>
    </main>
  );
}
