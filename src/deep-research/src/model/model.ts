import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";

export function getModel(options?: ChatOpenAICallOptions & { modelName?: string, temperature?: number }) {
  return new ChatOpenAI({
    modelName: 'openai/gpt-5',
    model: 'openai/gpt-5',
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: options?.temperature ?? 0.1,
    configuration: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "agent-test",
      },
    },
    
    ...options,
  });
  // return new ChatOpenAI({
  //   modelName: "deepseek-chat",
  //   model: "deepseek-chat",
  //   apiKey: process.env.DEEPSEEK_API_KEY,
  //   temperature: options?.temperature ?? 0.1,
  //   configuration: {
  //     apiKey: process.env.DEEPSEEK_API_KEY,
  //     baseURL: "https://api.deepseek.com",
  //   },
  //   ...options,
  // });
}