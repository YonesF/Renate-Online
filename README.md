# CreativeArt hjelpesenter + Lena

Hjelpeside, AI-assistent og konsoll for creativeart.no. Arkitektur, flyt og rekkefølge står i [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md).

Status: prototype. Hjelpesiden viser guidene fra `knowledge/`, og Lena svarer i chatten ut fra dem. Ikke bygd: søk (`search` svarer 501), konsollen for ansatte og sporing til Langfuse.

| Mappe | Tjeneste | Språk | Eier |
|---|---|---|---|
| `web/` | Nettstedene `hjelp`, `agent` og `admin` | PHP 8.5, Twig | MySQL |
| `search/` | Indeksering og hybrid søk | Rust | Qdrant, Voyage-nøkkelen |
| `agent/` | Lena | Python 3.13 | Anthropic-nøkkelen |
| `contracts/` | JSON Schema for kallene mellom tjenestene | | |
| `knowledge/` | Markdown-kildene til kunnskapsbasen | | |

## Kom i gang

Krever Docker Desktop. Python 3.13 trengs for `bin/check`.

```bash
cp .env.example .env
```

Fyll inn `INTERNAL_TOKEN` (minst 32 tegn) og MySQL-passordene i `.env`. API-nøklene kan stå tomme til søk og chat bygges.

```bash
docker compose up --build -d
```

```bash
docker compose exec web php bin/console updatedb
```

```bash
docker compose exec web php bin/console kb:import
```

```bash
docker compose exec web php bin/console env:check
```

Lena trenger `ANTHROPIC_API_KEY` i `.env`. Uten den sier chatten at Lena er utilgjengelig.

Les samtalene, de som venter på en ansatt først:

```bash
docker compose exec web php bin/console conversations
```

| Adresse | Nettsted |
|---|---|
| http://hjelp.localhost:8080 | Hjelpesiden |
| http://agent.localhost:8080 | Lenas sidepanel |
| http://admin.localhost:8080 | Konsollen (stengt til innlogging er bygd) |

Bare `web` har en port ut. `search`, `agent`, MySQL og Qdrant nås kun på det interne nettet.

## Kvalitetsporten

```bash
python -m venv agent/.venv
```

```bash
agent/.venv/Scripts/python -m pip install -e "agent[dev]"
```

På macOS og Linux heter mappen `agent/.venv/bin`. Deretter, før hver commit:

```bash
bash bin/check
```

Den kjører ruff og pytest for `agent`, fmt, clippy og test for `search`, og lint, PHPStan og PHPUnit for `web`. Rust og PHP kjøres i Docker, så ingen av dem trenger å være installert på maskinen.

## Regler som koden håndhever

- En view må arve fra en sidetype med vakt. `web/tests/GuardTest.php` feiler ellers.
- Superglobals leses bare i `web/application/Http/Request.php`. `web/bin/lint` feiler ellers.
- `search` og `agent` starter ikke uten `INTERNAL_TOKEN`, og alt under `/v1` krever det.
- Hvert eksempel i `contracts/examples/` må passe skjemaet sitt. `agent/tests/test_contracts.py` feiler ellers.
- Hjelpesiden og Lena får bare se dokumenter som er publisert og offentlige. Filteret ligger i `Library`, ikke i sidene.
- Besøkende er ikke brukere. Bare en HMAC av enhetstokenet lagres, og en enhet ser aldri en annens samtale.
- Én nøkkel per tjeneste: `docker-compose.yml` gir Anthropic-nøkkelen bare til `agent` og Voyage-nøkkelen bare til `search`.
