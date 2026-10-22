# Renate Online – prototype

Chatbot med RAG og hjelpesenter for [CreativeArt.no](https://creativeart.no). IS-219, gruppe 15.

**Én kunnskapsbase, to innganger:** guidene i `content/guider` vises som artikler på hjelpesiden og er samtidig det chatboten svarer ut fra. Alt er designet etter creativeart.no (farger, fonter, knapper) og legges inn i butikken med **én linje kode**.

```html
<script src="https://DIN-APP.vercel.app/embed.js" defer></script>
```

---

## Kom i gang (5 minutter, ingen kontoer nødvendig)

```bash
npm install
npm run dev
```

Åpne <http://localhost:3000>. Startsiden viser status og lenker til alt:

| Side | Hva det er |
|---|---|
| `/hjelp` | Hjelpesenteret: søk, kategorier, populære spørsmål, guider |
| `/widget` | Selve chatten (det som vises i iframe på butikken) |
| `/demo.html` | En testbutikk med chatboblen lagt inn via `embed.js` |

Uten API-nøkler kjører alt i **demo-modus**: søket går lokalt i Markdown-filene, og chatten svarer med utdrag fra guidene. Feilsøkingsflyten, kildekortene og eskaleringen virker fullt ut.

### Slå på KI

Kopier `.env.example` til `.env.local` og legg inn én nøkkel, for eksempel `ANTHROPIC_API_KEY`. Start `npm run dev` på nytt. Startsiden viser hvilken modell som brukes.

---

## Test på den ekte nettsiden – uten tilgang til Shopify

Startsiden har et **bokmerke-script**. Dra det til bokmerkelinjen, åpne creativeart.no og klikk det: chatboblen dukker opp på den ekte siden, bare i *din* nettleser.

> **Viktig:** creativeart.no sender `upgrade-insecure-requests` og `block-all-mixed-content`. Et script fra `http://localhost` blir derfor blokkert. Appen må kjøre på **https**:
> - enklest: deploy til Vercel (gratis) og bruk bokmerket fra Vercel-adressen, eller
> - lokalt: `npm run dev:https` (lager et lokalt sertifikat).

---

## Mappestruktur

```
content/
  guider/*.md          ← kunnskapsbasen (Markdown med felter øverst)
  flyter/*.json        ← faste feilsøkingsflyter (steg skrevet av mennesker, ikke KI)
  kategorier.json      ← kategoriene på hjelpesiden
public/
  embed.js             ← ÉN linje i Shopify-temaet. Chatboble i Shadow DOM + iframe
  demo.html            ← testbutikk
src/
  app/
    hjelp/             ← hjelpesenteret
    widget/            ← chatten
    api/chat           ← RAG: søk → kilder → svar (strømmes som NDJSON)
    api/sok            ← søket på hjelpesiden (samme søk som chatten)
    api/eskaler        ← sak til Renate med oppsummering
  components/chat      ← ChatWidget, feilsøkingsflyt, skjema, kildekort
  components/help      ← søkefelt, kontaktboks, butikkramme
  lib/
    config.ts          ← ALL konfigurasjon (bytt prototype → produksjon her / i .env)
    content.ts         ← leser guidene. Bytt til Shopify Metaobjects her senere
    search/            ← lokalt BM25-søk + Supabase hybrid-søk med reranking
    prompt.ts          ← regler for språkmodellen
    ai.ts              ← valg av modell (bytt leverandør med én linje)
scripts/
  indekser.ts          ← guider → embeddings → Supabase
  test-sok.ts          ← evaluering av søket
supabase/schema.sql    ← tabeller, hybrid-søk, RLS
```

---

## Hvordan svaret lages

1. Kunden skriver. De to siste meldingene brukes som søk.
2. **Søk** i kunnskapsbasen: lokalt (BM25) eller i Supabase (pgvector + norsk fulltekst, slått sammen med Reciprocal Rank Fusion, deretter Cohere-reranking).
3. **Terskel:** er treffet usikkert, sier boten at den ikke vet, tilbyr Renate, og logger spørsmålet i `ubesvarte_sporsmal`.
4. **Kildene** sendes til widgeten først, deretter **strømmes svaret**. Språkmodellen får bare kildene og strenge regler (`src/lib/prompt.ts`) og henviser med [1], [2].
5. Hvis guiden har en **fast flyt** (f.eks. tette dyser), tilbys «Start steg-for-steg-feilsøking». Stegene kommer fra `content/flyter`, ikke fra KI.
6. **Eskalering:** Renate får e-post med utstyr, stegene kunden har prøvd og hele samtalen.

---

## Legg til eller endre innhold

Lag en ny fil i `content/guider/`, f.eks. `ny-guide.md`:

```markdown
---
tittel: Tittelen kunden ser
kategori: printer-og-dyser        # id fra kategorier.json
sammendrag: Én–to setninger som svarer kort.
problemer: [ord, kundene, bruker]  # hjelper søket
printere: [alle]                   # eller [Epson ET-2826, Epson L382]
populaer: true                     # vises under «Populære spørsmål»
oppdatert: 2026-10-22
status: eksempel                   # sett til «godkjent» når Renate har sjekket den
flyt: tette-dyser                  # valgfritt: kobler guiden til en feilsøkingsflyt
---

Innledning …

## Seksjon 1
…
```

Hver `##`-seksjon blir en egen «bit» i søket. Bruker dere Supabase: kjør `npm run indekser` etter endringer.

> ⚠️ **Guidene i prototypen er eksempelinnhold skrevet av gruppen.** De må gjennomgås og godkjennes av Renate før lansering (feltet `status`).

---

## Koble til Supabase (når dere er klare)

1. Opprett prosjekt på supabase.com i region **Stockholm (eu-north-1)**.
2. Kjør `supabase/schema.sql` i SQL Editor.
3. Legg `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` og `COHERE_API_KEY` i `.env.local`.
4. `npm run indekser`.
5. Startsiden skal nå vise «Søk: Supabase (hybrid)». Feiler Supabase, faller appen automatisk tilbake til lokalt søk.

## Evaluering

```bash
npm run test:sok
```

Kjører et testsett med spørsmål og forventet guide. **Bytt ut med 40–50 anonymiserte spørsmål fra Renates Messenger-historikk.** Kjør det hver gang dere endrer guider, søk, terskel eller modell. Dette er kvalitetssikringen dere lover i rapporten.

## Deploy til Vercel

1. Push til GitHub (repo og Vercel-konto bør eies av Creative Art).
2. Importer prosjektet i Vercel. Legg inn miljøvariablene fra `.env.example`.
3. Sett **Function Region** til Stockholm (`arn1`) eller Frankfurt (`fra1`). Standard er USA.
4. Hobby-planen er kun for ikke-kommersiell bruk. Til drift hos Creative Art trengs Pro.

## Integrasjon hos Renate

| Vei | Renate gjør | Resultat |
|---|---|---|
| **A. Lim inn én linje** | Tema → Rediger kode → `theme.liquid`, rett før `</body>`, eller en «Egendefinert Liquid»-seksjon | Chatboble på alle sider. Hjelpesiden lenkes fra menyen. |
| **B. Egen Shopify-app** (videre arbeid) | Klikker en installasjonslenke (custom distribution) | App embed, App Proxy (`creativeart.no/apps/hjelp`), innhold i Metaobjects |

Test alltid i en **kopi av temaet** (Tema → … → Dupliser) før publisering. Legg til butikkens domene i `ALLOWED_FRAME_ANCESTORS` hvis det avviker fra standard.

## Før lansering – sjekkliste

- [ ] Renate har godkjent alle guider (`status: godkjent`)
- [ ] Alle kontoer (Vercel, Supabase, LLM, Resend, GitHub) eies av Creative Art
- [ ] Kostnadstak satt hos LLM-leverandøren
- [ ] Rate limiting byttet til Upstash Ratelimit eller Vercel Firewall (minnebasert virker ikke på tvers av instanser)
- [ ] Databehandleravtaler, og personvernerklæringen oppdatert
- [ ] Sletting av saker etter 90 dager (se nederst i `schema.sql`)
- [ ] Testsettet utvidet til 40–50 ekte spørsmål og kjørt

## Videre arbeid

- Opplasting av bilde av dysekontroll, vurdert av en modell med bildeforståelse
- Tommel opp/ned på svar, lagret for evaluering
- Innboks for Renate (enkel adminside) i stedet for bare e-post
- Påminnelser om vedlikehold (Vercel Cron + e-post, med samtykke)
- Innhold fra Shopify Metaobjects i stedet for Markdown, så Renate redigerer i Shopify-admin
