import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * Kunnskapsbasen. I prototypen ligger innholdet som Markdown-filer i /content.
 * Alt annet i appen henter innhold gjennom funksjonene i denne filen, så senere kan
 * kilden byttes til Shopify Metaobjects eller en adminside uten å endre resten.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

export type Kategori = {
  id: string;
  navn: string;
  beskrivelse: string;
  ikon: string;
  /** Lenke til en eksisterende side i butikken i stedet for guider (f.eks. frakt). */
  ekstern?: string;
};

export type Guide = {
  slug: string;
  tittel: string;
  kategori: string;
  sammendrag: string;
  problemer: string[];
  printere: string[];
  populaer: boolean;
  oppdatert: string;
  status: "eksempel" | "godkjent";
  video?: string;
  flyt?: string;
  markdown: string;
};

export type Chunk = {
  id: string;
  slug: string;
  tittel: string;
  kategori: string;
  overskrift: string;
  tekst: string;
  printere: string[];
  nokkelord: string[];
};

export function hentKategorier(): Kategori[] {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, "kategorier.json"), "utf8");
  return JSON.parse(raw) as Kategori[];
}

export function hentGuider(): Guide[] {
  const dir = path.join(CONTENT_DIR, "guider");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      return {
        slug: file.replace(/\.md$/, ""),
        tittel: String(data.tittel),
        kategori: String(data.kategori),
        sammendrag: String(data.sammendrag ?? ""),
        problemer: (data.problemer as string[]) ?? [],
        printere: (data.printere as string[]) ?? ["alle"],
        populaer: Boolean(data.populaer),
        oppdatert: String(data.oppdatert ?? ""),
        status: data.status === "godkjent" ? "godkjent" : "eksempel",
        video: data.video ? String(data.video) : undefined,
        flyt: data.flyt ? String(data.flyt) : undefined,
        markdown: content.trim(),
      } satisfies Guide;
    })
    .sort((a, b) => a.tittel.localeCompare(b.tittel, "nb"));
}

export function hentGuide(slug: string): Guide | undefined {
  return hentGuider().find((g) => g.slug === slug);
}

export function guideTilHtml(guide: Guide): string {
  return marked.parse(guide.markdown, { async: false });
}

/** Deler hver guide opp i biter per «##»-seksjon, som er det søket og chatboten jobber med. */
export function lagChunks(guider: Guide[] = hentGuider()): Chunk[] {
  const chunks: Chunk[] = [];
  for (const g of guider) {
    const deler = g.markdown.split(/^## /m);
    deler.forEach((del, i) => {
      const linjer = del.trim().split("\n");
      const overskrift = i === 0 ? "Oversikt" : linjer[0].trim();
      const brodtekst = (i === 0 ? linjer : linjer.slice(1)).join("\n").trim();
      if (!brodtekst) return;
      const tekst = i === 0 ? `${g.sammendrag}\n\n${brodtekst}` : brodtekst;
      chunks.push({
        id: `${g.slug}#${i}`,
        slug: g.slug,
        tittel: g.tittel,
        kategori: g.kategori,
        overskrift,
        tekst: rensMarkdown(tekst),
        printere: g.printere,
        nokkelord: g.problemer,
      });
    });
  }
  return chunks;
}

export function rensMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
