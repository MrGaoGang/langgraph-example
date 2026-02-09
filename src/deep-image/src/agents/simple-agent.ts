import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DeepImageRequest, GeneratedImage } from "../types";
import { getChatModel } from "../model/chat";
import { generateImage } from "../model/image";
import { toImageUrlOrDataUrl } from "../utils/image";
import { logger } from "../utils/friendly-log";

async function enrichPromptWithReferenceImage(params: {
  prompt: string;
  imageUrl: string;
  context?: string;
}) {
  const model = getChatModel({ temperature: 0.2, modelName: "google/gemini-2.5-flash-image" });

  const system = new SystemMessage(
    [
      "你是图片生成提示词优化器。",
      "给定用户 prompt + 一张参考图，请总结参考图关键视觉要点，并把它们融入生成提示词。",
      "输出只要最终用于生成的 prompt 文本，不要输出解释。",
    ].join("\n")
  );

  const userTextParts: string[] = [`用户 prompt：${params.prompt}`];
  if (params.context) userTextParts.push(`补充上下文：${params.context}`);

  const human = new HumanMessage({
    content: [
      { type: "text", text: userTextParts.join("\n") },
      { type: "image_url", image_url: { url: params.imageUrl } },
    ] as any,
  });

  const res = await model.invoke([system, human]);
  const content = res.content as any;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => c?.text ?? "").join("");
  return String(content ?? params.prompt);
}

/**
 * SIMPLE 模式：直接生成图片
 */
export async function runSimpleAgent(request: DeepImageRequest) {
  const imageUrl = toImageUrlOrDataUrl(request.image);

  let finalPrompt = request.prompt;
  let raw: unknown;

  // if (imageUrl) {
  //   try {
  //     const enriched = await enrichPromptWithReferenceImage({
  //       prompt: request.prompt,
  //       imageUrl,
  //       context: request.context,
  //     });
  //     finalPrompt = enriched;
  //     raw = { enrichedPrompt: enriched };
  //   } catch {
  //     finalPrompt = `${request.prompt}\n\n参考图片：${imageUrl}`;
  //   }
  // }
  const image = await generateImage({
    prompt: finalPrompt,
    imageUrls: imageUrl ? [imageUrl] : undefined,
    format: request.output?.format,
    model: 'bytedance-seed/seedream-4.5',
  });
  logger.success(`[simple-agent] generated image url: ${image.data}`);
  
  return { image, raw };
}