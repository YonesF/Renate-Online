import { IkonChat, IkonPerson } from "@/components/icons";
import { butikk } from "@/lib/config";
import { ApneChat } from "./ApneChat";

export function Kontaktboks() {
  return (
    <section className="rounded-ca-panel border border-ca-red/25 bg-ca-red-tint p-6">
      <h2 className="font-display text-xl font-semibold">Fant du ikke svaret?</h2>
      <p className="mt-1 max-w-prose">
        Beskriv problemet med egne ord til assistenten. Hvis den ikke finner svaret, sender den saken videre til
        Renate – med alt du allerede har prøvd.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ApneChat className="inline-flex items-center gap-2 rounded-ca bg-ca-red px-4 py-2.5 font-medium text-white hover:bg-ca-red-dark">
          <IkonChat className="size-5" /> Spør assistenten
        </ApneChat>
        <a
          href={butikk.messengerUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-ca border-2 border-ca-grey bg-white px-4 py-2 text-ca-grey hover:border-ca-red hover:text-ca-red"
        >
          <IkonPerson className="size-5" /> Kontakt Renate på Messenger
        </a>
      </div>
    </section>
  );
}
