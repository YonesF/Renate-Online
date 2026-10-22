import Script from "next/script";
import { Butikkramme } from "@/components/help/Butikkramme";

export default function HjelpLayout({ children }: LayoutProps<"/hjelp">) {
  return (
    <Butikkramme>
      {children}
      {/* Samme én-linjes integrasjon som Renate skal lime inn i Shopify-temaet. */}
      <Script src="/embed.js" strategy="afterInteractive" />
    </Butikkramme>
  );
}
