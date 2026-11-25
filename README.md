# Renate Online – statisk utgave for GitHub Pages

Denne grenen inneholder bare nettsiden: hjelpesenteret fra prototypen som ferdige HTML-, CSS- og JavaScript-filer. Det er ingen PHP, ingen database og ingen API-nøkler. Alt kan brukes som i prototypen:
- søk med forslag mens du skriver
- kategorier og temaer
- vedlikeholdsguiden med bilder
- populære spørsmål
- chatten med Lena

**Adresse når GitHub Pages er slått på:** https://yonesf.github.io/Renate-Online/

## Lena i denne utgaven

GitHub Pages kan ikke kjøre en server, og en API-nøkkel i nettleseren ville vært synlig for alle. Derfor svarer Lena slik:

- **Ekte svar på vanlige spørsmål.** 16 vanlige spørsmål ble stilt til den ekte Lena (Claude) i prototypen, og svarene ligger i `lena/answers.js`. Når kunden spør om noe som ligner, vises Lenas eget svar, strømmet og med lenker til guiden. Det gjelder også overlevering ved spørsmål om pakke og retur.
- **Søk i hjelpesenteret ellers.** Andre spørsmål besvares med et søk i hjelpesenterets egne tekster. Svaret er merket «Demo – søk i hjelpesenteret».
- **Ingenting sendes noe sted.** Samtalen blir bare i nettleseren og følger med fra side til side.

Under skrivefeltet står det at chatten er en demo.

## Slå på GitHub Pages

1. Gå til **Settings → Pages**.
2. Under **Source**, velg «Deploy from a branch».
3. Velg branch `PrøvbarDemo` og mappen `/ (root)`, og trykk **Save**.

Etter et par minutter ligger siden på adressen over.

## Forhåndsvisning lokalt

```
node tools/serve.mjs
```

Åpne http://localhost:4173/Renate-Online/. Serveren oppfører seg som GitHub Pages, med samme undermappe og 404-side.

## Lage utgaven på nytt

Kjør verktøyene fra en checkout av denne grenen mens prototypen kjører lokalt (`docker compose up` på grenen `ux-support-page-refactor`):

```
node tools/record-lena.mjs
node tools/export.mjs
```

`record-lena.mjs` tar opp Lenas svar på nytt, med ett kall til Claude per spørsmål. Spørsmålene står øverst i skriptet. `export.mjs` henter alle sidene og bygger utgaven.

## Forskjeller fra prototypen

- Lena er en demo, som beskrevet over.
- Den røde stripen øverst har merket «Prototype».
- Sidene er merket `noindex`, så de ikke dukker opp i søkemotorer som Creative Arts hjelpesenter.
- Toppfeltet bryter over to linjer på mobil. I prototypen blir siden for bred på telefon.
