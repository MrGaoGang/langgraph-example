import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";

function normalizeModelName(baseURL: string | undefined, model: string) {
  if (baseURL?.includes("openrouter.ai") && !model.includes("/")) {
    return `openai/${model}`;
  }
  return model;
}

export function getChatModel(
  options?: ChatOpenAICallOptions & { temperature?: number; modelName?: string }
) {
  const baseURL =
    process.env.OPENAI_BASE_URL ??
    (process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined);

  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;

  const rawModel =
    options?.modelName ??
    process.env.OPENAI_MODEL ??
    (baseURL?.includes("openrouter.ai") ? "gpt-4o-mini" : "gpt-4o-mini");

  const modelName = normalizeModelName(baseURL, rawModel);

  return new ChatOpenAI({
    modelName,
    temperature: options?.temperature ?? 0.2,
    apiKey,
    configuration: baseURL ? { baseURL } : undefined,
    ...options,
  });
}