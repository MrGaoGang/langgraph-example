import { OpenAI, type ChatCompletionMessage } from "openai";
import { DeepImageOutputFormat, GeneratedImage } from "../types";
import { defaultSystemPrompt } from "../prompt/system-prompt";

let cachedClient: OpenAI | undefined;

function getOpenRouterClient() {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing env: OPENROUTER_API_KEY (required for OpenRouter image generation)"
    );
  }

  cachedClient = new OpenAI({
    baseURL: process.env.IMAGE_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders:
      process.env.OPENROUTER_HTTP_REFERER || process.env.OPENROUTER_X_TITLE
        ? {
            ...(process.env.OPENROUTER_HTTP_REFERER
              ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
              : {}),
            ...(process.env.OPENROUTER_X_TITLE
              ? { "X-Title": process.env.OPENROUTER_X_TITLE }
              : {}),
          }
        : undefined,
  });

  return cachedClient;
}

/**
 * 通过 OpenRouter 的多模态模型生成图片。
 * 说明：OpenRouter 的图片模型通常通过 `chat.completions` 返回 `message.images`（URL 列表）。
 */
export async function generateImage(params: {
  prompt: string;
  /** 参考图片（url 或 data url） */
  imageUrls?: string[];
  /** 一些模型不支持结构化 size 参数，这里会注入到 prompt 中 */
  size?: string;
  /** OpenRouter 图片模型通常返回 url；保留该字段用于对齐对外类型 */
  format?: DeepImageOutputFormat;
  /** OpenRouter 模型名，例如：google/gemini-2.5-flash-image-preview */
  model?: string;
  /** 可选 system prompt */
  systemPrompt?: string;
}): Promise<GeneratedImage> {
  const client = getOpenRouterClient();

  const model =
    params.model ??
    process.env.IMAGE_MODEL ??
    "google/gemini-2.5-flash-image";

  const format: DeepImageOutputFormat = params.format ?? "url";

  const contents: any[] = [
    {
      type: "text",
      text: params.size
        ? `${params.prompt}\n\n输出尺寸偏好：${params.size}`
        : params.prompt,
    },
  ];

  (params.imageUrls ?? []).forEach((url) => {
    contents.push({
      type: "image_url",
      image_url: { url },
    });
  });
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          params.systemPrompt ??
          defaultSystemPrompt,
      },
      {
        role: "user",
        content: contents,
      },
    ],
  });

  const msg = response.choices?.[0]?.message as (ChatCompletionMessage & {
    images?: { image_url: { url: string } }[];
  }) | null;

  const urls = msg?.images?.map((ele: any) => ele?.image_url?.url).filter(Boolean);
  const firstUrl = urls?.[0];

  if (!firstUrl) {
    const fallback = typeof msg?.content === "string" ? msg.content : "";
    throw new Error(
      `OpenRouter image generation returned no images. content=${fallback}`
    );
  }
  console.log(`[image] generated image url: ${firstUrl}`);

  return {
    format: format === "b64_json" ? "url" : format,
    data: firstUrl,
    model,
    size: params.size,
  };
}