"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IkonBok, IkonChat, IkonLukk, IkonPil, IkonSend, IkonSjekk, IkonSteg } from "@/components/icons";
import type { Flyt, FlytNode } from "@/lib/flows";
import type { ChatHendelse, ChatMelding, KildeKort } from "@/lib/protocol";
import { MeldingTekst } from "./MeldingTekst";

type Element =
  | {
      id: number;
      type: "melding";
      rolle: "kunde" | "assistent";
      tekst: string;
      kilder?: KildeKort[];
      sikker?: boolean;
      flyt?: { id: string; tittel: string };
      foreslaRenate?: boolean;
      modus?: "demo" | "ki";
      laster?: boolean;
      feil?: boolean;
    }
  | { id: number; type: "flyt"; flytId: string; nodeId: string; valgt?: string }
  | { id: number; type: "eskaler" };

type Props = {
  flyter: Flyt[];
  guideTitler: Record<string, string>;
  printere: string[];
  logoUrl: string;
  messengerUrl: string;
};

const FORSLAG = [
  "Jeg får striper i utskriften",
  "Hvordan tar jeg en dysekontroll?",
  "Fargene blir feil etter pressing",
  "Problemer etter blekkbytte",
];

const LAGRINGSNØKKEL = "renate-online:printer";

export function ChatWidget({ flyter, guideTitler, printere, logoUrl, messengerUrl }: Props) {
  const [elementer, setElementer] = useState<Element[]>([]);
  const [input, setInput] = useState("");
  const [opptatt, setOpptatt] = useState(false);
  const [printer, setPrinter] = useState<string | undefined>();
  const [iRamme, setIRamme] = useState(false);
  const provd = useRef<string[]>([]);
  const nesteId = useRef(1);
  const listeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const id = () => nesteId.current++;

  // Husk printervalget i denne nettleseren (fungerer ikke i privat modus – det er greit).
  useEffect(() => {
    try {
      const lagret = localStorage.getItem(LAGRINGSNØKKEL);
      if (lagret) setPrinter(lagret);
    } catch {}
    setIRamme(window.self !== window.top);
  }, []);

  useEffect(() => {
    listeRef.current?.scrollTo({ top: listeRef.current.scrollHeight, behavior: "smooth" });
  }, [elementer]);

  const velgPrinter = (p: string) => {
    setPrinter(p);
    try {
      localStorage.setItem(LAGRINGSNØKKEL, p);
    } catch {}
  };

  /** Samtalen slik API-et og Renate skal se den. */
  const historikk = useCallback((liste: Element[]): ChatMelding[] => {
    const ut: ChatMelding[] = [];
    for (const e of liste) {
      if (e.type === "melding" && e.tekst && !e.feil) ut.push({ rolle: e.rolle, tekst: e.tekst });
      if (e.type === "flyt") {
        const node = flyter.find((f) => f.id === e.flytId)?.noder[e.nodeId];
        if (node) ut.push({ rolle: "assistent", tekst: `[Feilsøkingssteg] ${node.tekst}` });
        if (e.valgt) ut.push({ rolle: "kunde", tekst: e.valgt });
      }
    }
    return ut;
  }, [flyter]);

  const sendMelding = async (tekst: string) => {
    const t = tekst.trim();
    if (!t || opptatt) return;
    setInput("");
    setOpptatt(true);

    const kundeEl: Element = { id: id(), type: "melding", rolle: "kunde", tekst: t };
    const svarId = id();
    const nyListe = [...elementer, kundeEl];
    setElementer([...nyListe, { id: svarId, type: "melding", rolle: "assistent", tekst: "", laster: true }]);

    const oppdater = (f: (e: Extract<Element, { type: "melding" }>) => Partial<Element>) =>
      setElementer((liste) =>
        liste.map((e) => (e.id === svarId && e.type === "melding" ? ({ ...e, ...f(e) } as Element) : e)),
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meldinger: historikk(nyListe), utstyr: { printer } }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.feil ?? "Noe gikk galt.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const linjer = buffer.split("\n");
        buffer = linjer.pop() ?? "";
        for (const linje of linjer) {
          if (!linje.trim()) continue;
          const h = JSON.parse(linje) as ChatHendelse;
          if (h.type === "kilder") oppdater(() => ({ kilder: h.kilder, sikker: h.sikker }));
          if (h.type === "tekst") oppdater((e) => ({ tekst: e.tekst + h.delta, laster: false }));
          if (h.type === "flyt") oppdater(() => ({ flyt: { id: h.id, tittel: h.tittel } }));
          if (h.type === "ferdig") oppdater(() => ({ laster: false, modus: h.modus, foreslaRenate: h.foreslaRenate }));
          if (h.type === "feil") oppdater(() => ({ laster: false, feil: true, tekst: h.melding }));
        }
      }
    } catch (err) {
      oppdater(() => ({
        laster: false,
        feil: true,
        tekst: err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.",
      }));
    } finally {
      setOpptatt(false);
      inputRef.current?.focus();
    }
  };

  const startFlyt = useCallback(
    (flytId: string) => {
      const flyt = flyter.find((f) => f.id === flytId);
      if (!flyt) return;
      setElementer((l) => [...l, { id: id(), type: "flyt", flytId, nodeId: flyt.start }]);
    },
    [flyter],
  );

  const velgIFlyt = (elementId: number, flyt: Flyt, node: FlytNode, valg: { tekst: string; til: string }) => {
    provd.current.push(`${node.tekst.split(". ")[0]} → ${valg.tekst}`);
    setElementer((liste) => {
      const oppdatert = liste.map((e) =>
        e.id === elementId && e.type === "flyt" ? { ...e, valgt: valg.tekst } : e,
      );
      const neste = flyt.noder[valg.til];
      const nye: Element[] = [{ id: id(), type: "flyt", flytId: flyt.id, nodeId: valg.til }];
      if (neste?.utfall === "eskaler") nye.push({ id: id(), type: "eskaler" });
      return [...oppdatert, ...nye];
    });
  };

  const åpneEskalering = () => {
    if (elementer.some((e) => e.type === "eskaler")) return;
    setElementer((l) => [...l, { id: id(), type: "eskaler" }]);
  };

  // Start en flyt fra lenke (?flyt=tette-dyser) eller fra hjelpesiden via embed.js.
  useEffect(() => {
    const fraUrl = new URLSearchParams(window.location.search).get("flyt");
    if (fraUrl) startFlyt(fraUrl);
    const lytter = (ev: MessageEvent) => {
      if (ev.data?.type === "renate:start-flyt" && typeof ev.data.id === "string") startFlyt(ev.data.id);
    };
    window.addEventListener("message", lytter);
    return () => window.removeEventListener("message", lytter);
  }, [startFlyt]);

  const lukk = () => window.parent.postMessage({ type: "renate:lukk" }, "*");
  const tom = elementer.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-white text-[15px] text-ca-ink">
      {/* Topp – butikkens rødfarge, som kunngjøringslinjen på creativeart.no */}
      <header className="flex items-center gap-3 bg-ca-red px-4 py-3 text-white">
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" className="size-8 object-contain" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-bold">Creative Art Assistent</p>
          <p className="flex items-center gap-1.5 text-[13px] text-white/85">
            <span className="size-2 rounded-full bg-[#7ee2a2]" aria-hidden />
            Svarer ut fra Creative Arts egne guider
          </p>
        </div>
        {iRamme && (
          <button
            onClick={lukk}
            className="grid size-9 place-items-center rounded-ca hover:bg-white/15"
            aria-label="Lukk chatten"
          >
            <IkonLukk className="size-5" />
          </button>
        )}
      </header>

      <div ref={listeRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        <BotBoble>
          <p>
            Hei! 👋 Jeg hjelper deg med sublimeringsprinteren din. Jeg svarer ut fra Renates egne guider,
            og sender deg videre til henne hvis jeg ikke finner svaret.
          </p>
        </BotBoble>

        {/* Utstyr – Renate trenger printermodell for å gi riktig råd */}
        <div className="ml-10 rounded-ca-panel border border-ca-line p-3">
          <p className="mb-2 text-[13px] font-medium text-ca-text">
            Hvilken printer bruker du? <span className="font-normal">(valgfritt)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {printere.map((p) => (
              <button
                key={p}
                onClick={() => velgPrinter(p)}
                aria-pressed={printer === p}
                className={`rounded-ca border px-2.5 py-1 text-[13px] transition-colors ${
                  printer === p
                    ? "border-ca-red bg-ca-red text-white"
                    : "border-ca-line bg-white text-ca-nav hover:border-ca-red hover:text-ca-red"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {tom && (
          <div className="ml-10 flex flex-wrap gap-1.5">
            {FORSLAG.map((f) => (
              <button
                key={f}
                onClick={() => sendMelding(f)}
                className="rounded-full border border-ca-red/30 bg-ca-red-tint px-3 py-1.5 text-[13px] text-ca-red hover:border-ca-red"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {elementer.map((e) => {
          if (e.type === "melding" && e.rolle === "kunde") {
            return (
              <div key={e.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-ca-panel rounded-br-sm bg-ca-red px-3.5 py-2 text-white">
                  {e.tekst}
                </p>
              </div>
            );
          }
          if (e.type === "melding") {
            return (
              <SvarMelding
                key={e.id}
                melding={e}
                onStartFlyt={startFlyt}
                onEskaler={åpneEskalering}
                harFlyt={elementer.some((x) => x.type === "flyt")}
              />
            );
          }
          if (e.type === "flyt") {
            const flyt = flyter.find((f) => f.id === e.flytId);
            const node = flyt?.noder[e.nodeId];
            if (!flyt || !node) return null;
            return (
              <FlytKort
                key={e.id}
                flyt={flyt}
                node={node}
                valgt={e.valgt}
                guideTittel={node.guide ? guideTitler[node.guide] : undefined}
                onVelg={(v) => velgIFlyt(e.id, flyt, node, v)}
              />
            );
          }
          return (
            <EskaleringsSkjema
              key={e.id}
              printer={printer}
              provd={provd.current}
              samtale={historikk(elementer)}
              messengerUrl={messengerUrl}
            />
          );
        })}
      </div>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          sendMelding(input);
        }}
        className="border-t border-ca-line px-3 pb-2 pt-3"
      >
        <div className="flex items-end overflow-hidden rounded-ca border border-ca-red focus-within:ring-2 focus-within:ring-ca-red/20">
          <label htmlFor="chat-input" className="sr-only">
            Skriv spørsmålet ditt
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(ev) => setInput(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                sendMelding(input);
              }
            }}
            rows={1}
            maxLength={1500}
            placeholder="Beskriv problemet med egne ord …"
            className="max-h-28 min-h-11 flex-1 resize-none bg-white px-3 py-2.5 text-[15px] text-ca-ink outline-none placeholder:text-ca-text/80 [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={opptatt || !input.trim()}
            className="grid size-11 shrink-0 place-items-center bg-ca-red text-white transition-colors hover:bg-ca-red-dark disabled:opacity-50"
            aria-label="Send"
          >
            <IkonSend className="size-5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-ca-text">
          <span>Svar kan inneholde feil – sjekk kildene.</span>
          <button type="button" onClick={åpneEskalering} className="font-medium text-ca-red hover:underline">
            Kontakt Renate
          </button>
        </div>
      </form>
    </div>
  );
}

function BotBoble({ children, feil }: { children: React.ReactNode; feil?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ca-red-tint text-ca-red">
        <IkonChat className="size-4" />
      </span>
      <div
        className={`max-w-[85%] rounded-ca-panel rounded-tl-sm px-3.5 py-2.5 ${
          feil ? "border border-ca-red/40 bg-ca-red-tint text-ca-red" : "bg-ca-surface"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function SvarMelding({
  melding,
  onStartFlyt,
  onEskaler,
  harFlyt,
}: {
  melding: Extract<Element, { type: "melding" }>;
  onStartFlyt: (id: string) => void;
  onEskaler: () => void;
  harFlyt: boolean;
}) {
  const unike = (melding.kilder ?? []).filter(
    (k, i, a) => a.findIndex((x) => x.slug === k.slug) === i,
  );
  return (
    <div className="space-y-2">
      <BotBoble feil={melding.feil}>
        {melding.laster && !melding.tekst ? (
          <span className="flex gap-1 py-1.5" aria-label="Skriver …">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-1.5 animate-bounce rounded-full bg-ca-text"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        ) : (
          <MeldingTekst tekst={melding.tekst} kilder={melding.kilder} />
        )}
      </BotBoble>

      {!melding.laster && melding.sikker && unike.length > 0 && (
        <div className="ml-10 space-y-1.5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-ca-text">Kilder</p>
          <div className="grid gap-1.5">
            {unike.slice(0, 3).map((k) => (
              <a
                key={k.slug}
                href={k.url}
                target="_blank"
                rel="noopener"
                className="group flex items-center gap-2.5 rounded-ca border border-ca-line bg-white px-3 py-2 hover:border-ca-red"
              >
                <IkonBok className="size-4 shrink-0 text-ca-red" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ca-ink group-hover:text-ca-red">
                    {k.tittel}
                  </span>
                  <span className="block truncate text-[12px] text-ca-text">Guide · {k.overskrift}</span>
                </span>
                <IkonPil className="size-4 shrink-0 text-ca-text group-hover:text-ca-red" />
              </a>
            ))}
          </div>
        </div>
      )}

      {!melding.laster && melding.flyt && !harFlyt && (
        <button
          onClick={() => onStartFlyt(melding.flyt!.id)}
          className="ml-10 flex items-center gap-2 rounded-ca bg-ca-red px-3.5 py-2 text-[14px] font-medium text-white hover:bg-ca-red-dark"
        >
          <IkonSteg className="size-4" />
          Start steg-for-steg-feilsøking
        </button>
      )}

      {!melding.laster && melding.foreslaRenate && (
        <button
          onClick={onEskaler}
          className="ml-10 rounded-ca border-2 border-ca-grey bg-white px-3.5 py-1.5 text-[14px] text-ca-grey hover:border-ca-red hover:text-ca-red"
        >
          Send saken til Renate
        </button>
      )}

      {!melding.laster && melding.modus === "demo" && (
        <p className="ml-10 text-[11px] text-ca-text">Demo-modus: svaret er hentet direkte fra guidene, uten KI.</p>
      )}
    </div>
  );
}

function FlytKort({
  flyt,
  node,
  valgt,
  guideTittel,
  onVelg,
}: {
  flyt: Flyt;
  node: FlytNode;
  valgt?: string;
  guideTittel?: string;
  onVelg: (v: { tekst: string; til: string }) => void;
}) {
  const ferdig = node.utfall === "lost";
  return (
    <div className="ml-10 overflow-hidden rounded-ca-panel border border-ca-line bg-white">
      <div className="flex items-center gap-2 border-b border-ca-line bg-ca-surface/60 px-3 py-1.5 text-[12px] font-medium text-ca-text">
        {ferdig ? <IkonSjekk className="size-4 text-ca-success" /> : <IkonSteg className="size-4 text-ca-red" />}
        {ferdig ? "Løst" : flyt.tittel.replace(/^Feilsøking:\s*/i, "Feilsøking · ")}
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <p>{node.tekst}</p>
        {node.detaljer && (
          <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ca-text marker:text-ca-red">
            {node.detaljer.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
        {node.guide && (
          <a
            href={`/hjelp/${node.guide}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-ca-red hover:underline"
          >
            <IkonBok className="size-3.5" /> Se guiden{guideTittel ? `: ${guideTittel}` : ""}
          </a>
        )}
        {node.valg && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {node.valg.map((v) => (
              <button
                key={v.tekst}
                disabled={!!valgt}
                onClick={() => onVelg(v)}
                className={`rounded-ca border-2 px-3 py-1.5 text-[13px] transition-colors ${
                  valgt === v.tekst
                    ? "border-ca-red bg-ca-red text-white"
                    : valgt
                      ? "border-ca-line text-ca-text opacity-60"
                      : "border-ca-grey bg-white text-ca-grey hover:border-ca-red hover:text-ca-red"
                }`}
              >
                {v.tekst}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EskaleringsSkjema({
  printer,
  provd,
  samtale,
  messengerUrl,
}: {
  printer?: string;
  provd: string[];
  samtale: ChatMelding[];
  messengerUrl: string;
}) {
  const [status, setStatus] = useState<"skjema" | "sender" | "sendt">("skjema");
  const [saksnummer, setSaksnummer] = useState("");
  const [feil, setFeil] = useState("");

  const send = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const data = new FormData(ev.currentTarget);
    setStatus("sender");
    setFeil("");
    try {
      const res = await fetch("/api/eskaler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          navn: data.get("navn"),
          epost: data.get("epost"),
          beskrivelse: data.get("beskrivelse"),
          utstyr: { printer },
          provd,
          samtale,
        }),
      });
      const svar = await res.json();
      if (!res.ok) throw new Error(svar.feil ?? "Kunne ikke sende saken.");
      setSaksnummer(svar.saksnummer);
      setStatus("sendt");
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Kunne ikke sende saken.");
      setStatus("skjema");
    }
  };

  if (status === "sendt") {
    return (
      <div className="ml-10 space-y-1.5 rounded-ca-panel border border-ca-success/40 bg-[#eef7f1] px-3 py-3">
        <p className="flex items-center gap-1.5 font-bold text-ca-success">
          <IkonSjekk className="size-4" /> Saken er sendt ({saksnummer})
        </p>
        <p className="text-[14px]">
          Renate har fått samtalen og det du har prøvd, og tar kontakt på e-post. Haster det, kan du også{" "}
          <a href={messengerUrl} target="_blank" rel="noopener" className="font-medium text-ca-red underline">
            skrive til henne på Messenger
          </a>{" "}
          og oppgi saksnummeret.
        </p>
      </div>
    );
  }

  const felt =
    "w-full rounded-ca border border-ca-line bg-white px-2.5 py-2 text-[14px] text-ca-ink outline-none focus:border-ca-red";

  return (
    <form onSubmit={send} className="ml-10 space-y-2.5 rounded-ca-panel border border-ca-line bg-white p-3">
      <div>
        <p className="font-bold">Send saken til Renate</p>
        <p className="text-[13px] text-ca-text">
          Hun får hele samtalen{provd.length ? ` og de ${provd.length} stegene du har prøvd` : ""}, så du slipper å
          forklare alt på nytt.
        </p>
      </div>
      <input name="navn" required placeholder="Navn" autoComplete="name" className={felt} aria-label="Navn" />
      <input
        name="epost"
        type="email"
        required
        placeholder="E-post"
        autoComplete="email"
        className={felt}
        aria-label="E-post"
      />
      <textarea
        name="beskrivelse"
        rows={2}
        placeholder="Noe mer Renate bør vite? (valgfritt)"
        className={felt}
        aria-label="Tilleggsinformasjon"
      />
      <label className="flex items-start gap-2 text-[12px] text-ca-text">
        <input type="checkbox" required className="mt-0.5 accent-[var(--ca-red)]" />
        Jeg godtar at samtalen og kontaktinformasjonen sendes til Creative Art for å svare på saken.
      </label>
      {feil && <p className="text-[13px] text-ca-red">{feil}</p>}
      <button
        disabled={status === "sender"}
        className="w-full rounded-ca bg-ca-red py-2 text-[14px] font-medium text-white hover:bg-ca-red-dark disabled:opacity-60"
      >
        {status === "sender" ? "Sender …" : "Send til Renate"}
      </button>
    </form>
  );
}
