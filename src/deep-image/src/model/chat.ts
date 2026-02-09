import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";


export function getChatModel(
  options?: ChatOpenAICallOptions & { temperature?: number; modelName?: string }
) {
  const baseURL =
    process.env.OPENAI_BASE_URL ??
    (process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined);

  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;

  const modelName =
    options?.modelName ??
    process.env.OPENAI_MODEL ??
    (baseURL?.includes("openrouter.ai") ? "openai/gpt-4o-mini" : "gpt-4o-mini");

  return new ChatOpenAI({
    modelName,
    temperature: options?.temperature ?? 0.2,
    apiKey,
    configuration: baseURL ? { baseURL } : undefined,
    ...options,
  });
}