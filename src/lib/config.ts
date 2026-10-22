/**
 * All konfigurasjon samlet ett sted. Alt butikkspesifikt ligger i miljøvariabler,
 * slik at overgangen fra prototype til Creative Arts egne kontoer bare er å bytte verdier.
 */

const env = (key: string) => {
  const value = process.env[key];
  return value && value.trim() !== "" ? value.trim() : undefined;
};

export const butikk = {
  navn: "CreativeArt.no",
  url: env("NEXT_PUBLIC_STORE_URL") ?? "https://creativeart.no",
  messengerUrl:
    env("NEXT_PUBLIC_MESSENGER_URL") ?? "https://www.facebook.com/creativeart.no",
  logoUrl:
    env("NEXT_PUBLIC_LOGO_URL") ??
    "https://creativeart.no/cdn/shop/files/creativeart-black-square_f06b920f-0907-42db-bc2c-1fde45a9dfbf_1200x1200.png?v=1741643722",
};

export type LlmProvider = "anthropic" | "openai" | "google";

/** Hvilken språkmodell som brukes. Uten nøkkel kjører chatten i demo-modus. */
export function llmConfig(): { provider: LlmProvider; model: string } | null {
  const wanted = env("LLM_PROVIDER") as LlmProvider | undefined;
  const defaults: Record<LlmProvider, string> = {
    anthropic: "claude-haiku-5-5",
    openai: "gpt-5.4-mini",
    google: "gemini-flash-latest",
  };
  const hasKey: Record<LlmProvider, boolean> = {
    anthropic: !!env("ANTHROPIC_API_KEY"),
    openai: !!env("OPENAI_API_KEY"),
    google: !!env("GOOGLE_GENERATIVE_AI_API_KEY"),
  };
  const provider =
    wanted && hasKey[wanted]
      ? wanted
      : (["anthropic", "openai", "google"] as const).find((p) => hasKey[p]);
  if (!provider) return null;
  return { provider, model: env("LLM_MODEL") ?? defaults[provider] };
}

export type EmbeddingProvider = "openai" | "cohere";

/** Embeddings brukes bare når kunnskapsbasen ligger i Supabase. */
export function embeddingConfig(): { provider: EmbeddingProvider; model: string } | null {
  const wanted = (env("EMBEDDING_PROVIDER") as EmbeddingProvider | undefined) ?? "cohere";
  if (wanted === "cohere" && env("COHERE_API_KEY")) {
    return { provider: "cohere", model: env("EMBEDDING_MODEL") ?? "embed-multilingual-v3.0" };
  }
  if (env("OPENAI_API_KEY")) {
    return { provider: "openai", model: env("EMBEDDING_MODEL") ?? "text-embedding-3-large" };
  }
  return null;
}

/** Alle vektorer lagres med 1024 dimensjoner (se supabase/schema.sql). */
export const EMBEDDING_DIMENSIONS = 1024;

export function supabaseConfig(): { url: string; serviceKey: string } | null {
  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  return url && serviceKey ? { url, serviceKey } : null;
}

export function rerankConfig(): { model: string } | null {
  return env("COHERE_API_KEY") ? { model: env("RERANK_MODEL") ?? "rerank-v3.5" } : null;
}

/** "lokal" = søk i Markdown-filene i minnet. "supabase" = hybrid-søk i Postgres. */
export function sokemodus(): "lokal" | "supabase" {
  return supabaseConfig() && embeddingConfig() ? "supabase" : "lokal";
}

export const eskalering = {
  resendKey: env("RESEND_API_KEY"),
  til: env("ESKALERING_EPOST"),
  fra: env("ESKALERING_AVSENDER") ?? "Renate Online <onboarding@resend.dev>",
};

export const grenser = {
  maksTegnPerMelding: 1500,
  maksMeldingerIHistorikk: 12,
  forespørslerPerMinutt: Number(env("RATE_LIMIT_PER_MINUTE") ?? 20),
};
