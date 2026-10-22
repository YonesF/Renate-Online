import { anthropic } from "@ai-sdk/anthropic";
import { cohere } from "@ai-sdk/cohere";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { EMBEDDING_DIMENSIONS, embeddingConfig, llmConfig } from "./config";

/**
 * Bytte av modell skjer bare her (eller i .env). Resten av appen vet ikke hvilken
 * leverandør som brukes.
 */
export function språkmodell() {
  const cfg = llmConfig();
  if (!cfg) return null;
  switch (cfg.provider) {
    case "anthropic":
      return anthropic(cfg.model);
    case "openai":
      return openai(cfg.model);
    case "google":
      return google(cfg.model);
  }
}

function embeddingModell() {
  const cfg = embeddingConfig();
  if (!cfg) throw new Error("Ingen embedding-nøkkel satt (COHERE_API_KEY eller OPENAI_API_KEY).");
  return cfg.provider === "cohere"
    ? { model: cohere.embedding(cfg.model), provider: cfg.provider }
    : { model: openai.embedding(cfg.model), provider: cfg.provider };
}

function providerOptions(provider: string, type: "search_query" | "search_document") {
  return provider === "cohere" ? { cohere: { inputType: type } } : undefined;
}

export async function embedSporring(tekst: string): Promise<number[]> {
  const { model, provider } = embeddingModell();
  const { embedding } = await embed({
    model,
    value: tekst,
    dimensions: provider === "openai" ? EMBEDDING_DIMENSIONS : undefined,
    providerOptions: providerOptions(provider, "search_query"),
  });
  return embedding;
}

export async function embedDokumenter(tekster: string[]): Promise<number[][]> {
  const { model, provider } = embeddingModell();
  const { embeddings } = await embedMany({
    model,
    values: tekster,
    dimensions: provider === "openai" ? EMBEDDING_DIMENSIONS : undefined,
    providerOptions: providerOptions(provider, "search_document"),
  });
  return embeddings;
}
