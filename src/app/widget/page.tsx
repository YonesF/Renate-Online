import type { Metadata } from "next";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { butikk } from "@/lib/config";
import { hentGuider } from "@/lib/content";
import { hentFlyter } from "@/lib/flows";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false },
};

/** Printermodellene fra brukerundersøkelsen, pluss vanlige søskenmodeller. */
const PRINTERE = ["Epson ET-2815", "Epson ET-2825", "Epson ET-2826", "Epson ET-2864", "Epson L382", "Annen"];

/**
 * /widget – selve chatten. Vises i en iframe som embed.js legger inn på nettbutikken,
 * men fungerer også som egen side (fint for testing og brukertester).
 */
export default function WidgetSide() {
  const guideTitler = Object.fromEntries(hentGuider().map((g) => [g.slug, g.tittel]));
  return (
    <ChatWidget
      flyter={hentFlyter()}
      guideTitler={guideTitler}
      printere={PRINTERE}
      logoUrl={butikk.logoUrl}
      messengerUrl={butikk.messengerUrl}
    />
  );
}
