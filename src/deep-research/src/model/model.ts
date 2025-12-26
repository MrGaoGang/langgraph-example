import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";

export function getModel(options?: ChatOpenAICallOptions & { modelName?: string, temperature?: number }) {
  return new ChatOpenAI({
    modelName: 'openai/gpt-4o',
    model: 'openai/gpt-4o',
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: options?.temperature ?? 0.1,
    configuration: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    },
    ...options,
  });
}