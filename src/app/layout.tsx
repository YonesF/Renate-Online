import type { Metadata, Viewport } from "next";
// Fontene hostes selv (ingen kall til Google Fonts) – samme fonter som creativeart.no.
import "@fontsource/cabin/400.css";
import "@fontsource/cabin/500.css";
import "@fontsource/cabin/700.css";
import "@fontsource/fraunces/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hjelpesenter – CreativeArt.no",
    template: "%s – CreativeArt.no",
  },
  description:
    "Feilsøking, vedlikehold og svar på vanlige spørsmål om sublimeringsprintere fra CreativeArt.no.",
};

export const viewport: Viewport = {
  themeColor: "#a61000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
