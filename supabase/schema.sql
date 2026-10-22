-- Renate Online – databaseoppsett for Supabase (Postgres + pgvector)
-- Kjør hele filen i Supabase → SQL Editor. Velg region Stockholm (eu-north-1) når prosjektet opprettes.

create extension if not exists vector;

-- ─────────────────────────────────────────────────────────────
-- 1. Kunnskapsbasen: én rad per seksjon i en guide
-- ─────────────────────────────────────────────────────────────
create table if not exists kunnskap_chunks (
  id          text primary key,              -- f.eks. "tette-dyser#2"
  slug        text not null,
  tittel      text not null,
  kategori    text not null,
  overskrift  text not null,
  tekst       text not null,
  printere    text[] not null default '{alle}',
  nokkelord   text[] not null default '{}',
  embedding   vector(1024),                  -- Cohere embed-multilingual-v3.0, eller OpenAI med dimensions=1024
  fts         tsvector generated always as (
                setweight(to_tsvector('norwegian', coalesce(tittel, '')), 'A') ||
                setweight(to_tsvector('norwegian', array_to_string(nokkelord, ' ')), 'A') ||
                setweight(to_tsvector('norwegian', coalesce(overskrift, '')), 'B') ||
                setweight(to_tsvector('norwegian', coalesce(tekst, '')), 'C')
              ) stored,
  oppdatert   timestamptz not null default now()
);

create index if not exists kunnskap_chunks_embedding_idx
  on kunnskap_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists kunnskap_chunks_fts_idx
  on kunnskap_chunks using gin (fts);

-- ─────────────────────────────────────────────────────────────
-- 2. Hybrid-søk: vektor (mening) + fulltekst (eksakte ord som «ET-2826»),
--    slått sammen med Reciprocal Rank Fusion.
-- ─────────────────────────────────────────────────────────────
create or replace function sok_hybrid(
  query_text      text,
  query_embedding vector(1024),
  match_count     int   default 20,
  full_text_weight float default 1,
  semantic_weight  float default 1,
  rrf_k           int   default 50
)
returns table (
  id text, slug text, tittel text, kategori text, overskrift text, tekst text,
  printere text[], likhet float, score float
)
language sql stable
as $$
with full_text as (
  select c.id,
         row_number() over (order by ts_rank_cd(c.fts, websearch_to_tsquery('norwegian', query_text)) desc) as rank_ix
  from kunnskap_chunks c
  where c.fts @@ websearch_to_tsquery('norwegian', query_text)
  limit match_count * 2
),
semantic as (
  select c.id,
         row_number() over (order by c.embedding <=> query_embedding) as rank_ix
  from kunnskap_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count * 2
)
select c.id, c.slug, c.tittel, c.kategori, c.overskrift, c.tekst, c.printere,
       1 - (c.embedding <=> query_embedding) as likhet,
       coalesce(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
       coalesce(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight as score
from full_text ft
full outer join semantic s on ft.id = s.id
join kunnskap_chunks c on c.id = coalesce(ft.id, s.id)
order by score desc
limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Saker som sendes videre til Renate
-- ─────────────────────────────────────────────────────────────
create table if not exists saker (
  id            uuid primary key default gen_random_uuid(),
  saksnummer    text unique not null,
  opprettet     timestamptz not null default now(),
  status        text not null default 'ny' check (status in ('ny', 'under arbeid', 'løst')),
  navn          text,
  epost         text,
  printer       text,
  blekk         text,
  oppsummering  text not null,
  provd         jsonb not null default '[]',
  samtale       jsonb not null default '[]'
);

-- ─────────────────────────────────────────────────────────────
-- 4. Forbedringssløyfen: spørsmål boten ikke fant svar på
-- ─────────────────────────────────────────────────────────────
create table if not exists ubesvarte_sporsmal (
  id         bigint generated always as identity primary key,
  opprettet  timestamptz not null default now(),
  sporsmal   text not null,
  printer    text,
  beste_treff text
);

-- ─────────────────────────────────────────────────────────────
-- 5. Sikkerhet: RLS på alt. Ingen policyer betyr at bare server-nøkkelen
--    (service role, brukes kun i Next.js-API-et) har tilgang. Nettleseren får aldri direkte tilgang.
-- ─────────────────────────────────────────────────────────────
alter table kunnskap_chunks     enable row level security;
alter table saker               enable row level security;
alter table ubesvarte_sporsmal  enable row level security;

-- Personvern: slett saker eldre enn 90 dager (kjør daglig med Supabase Cron, se README).
-- select cron.schedule('slett-gamle-saker', '0 3 * * *',
--   $$ delete from saker where opprettet < now() - interval '90 days' $$);
