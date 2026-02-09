import { z } from "zod";
import { tool } from "langchain";
import { createAgent } from "../agents/agentFactory";
import { getChatModel } from "../model/chat";
import { generateImage } from "../model/image";
import { DeepImagePlan, GeneratedImage } from "../types";
import { toImageUrlOrDataUrl } from "../utils/image";

const EXECUTOR_SYSTEM_PROMPT = `
你是 DeepImage 的 Executor（执行 Agent）。

输入：用户当前诉求 + 已确认（或已编辑）的计划 plan。
输出：严格 JSON（不要 markdown、不要解释）：
{
  "finalPrompt": string,
  "size"?: string,
  "model"?: string,
  "format"?: "b64_json" | "url"
}

要求：
- 将用户的最新诉求合并进 plan（如用户提出改动，以用户为准）。
- finalPrompt 必须可直接用于图片生成 API(必须基于用户输入的图片及诉求)。
`.trim();

const planSchema = z.object({
  goal: z.string(),
  finalPrompt: z.string(),
  negativePrompt: z.string().optional(),
  size: z.string().optional(),
  steps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
    })
  ),
});

const execOutSchema = z.object({
  finalPrompt: z.string(),
  size: z.string().optional(),
  model: z.string().optional(),
  format: z.enum(["b64_json", "url"]).optional(),
});

function extractFirstJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

export async function executeImagePlan(params: {
  prompt: string;
  context?: string;
  image?: { url?: string; base64?: string; mimeType?: string };
  plan: DeepImagePlan;
  output?: { size?: string; format?: "b64_json" | "url"; model?: string };
}): Promise<{ image: GeneratedImage; raw?: unknown }> {
  const parsedPlan = planSchema.parse(params.plan);
  const imageRef = toImageUrlOrDataUrl(params.image);

  const agent = createAgent({
    model: getChatModel({ temperature: 0.2, modelName: 'openai/gpt-4o-mini' }),
    systemPrompt: EXECUTOR_SYSTEM_PROMPT,
  });

  let content = `用户最新诉求：${params.prompt}`;
  if (params.context) content += `\n\n补充上下文：\n${params.context}`;
  content += `\n\n已确认的计划（JSON）：\n${JSON.stringify(parsedPlan)}`;
  content += `\n\n请输出 JSON。`;

  const result = await agent.invoke({ messages: [{ role: "user", content }] });
  const last = result.messages[result.messages.length - 1]?.content ?? "";
  console.log(`[executeImagePlan] 原始输出：${JSON.stringify(result)}`);

  const jsonText = extractFirstJson(last);
  const execParsed = execOutSchema.safeParse(JSON.parse(jsonText));
  if (!execParsed.success) {
    throw new Error(`Executor output is not valid JSON: ${execParsed.error.message}`);
  }

  console.log(`[executeImagePlan] 执行计划：${JSON.stringify(execParsed.data)}`);
  const effectivePrompt = execParsed.data.finalPrompt ?? parsedPlan.finalPrompt;
  const size = params.output?.size ?? execParsed.data.size ?? parsedPlan.size;
  const format = params.output?.format ?? execParsed.data.format;
  const model = 'bytedance-seed/seedream-4.5';

  const image = await generateImage({
    prompt: effectivePrompt,
    imageUrls: imageRef ? [imageRef] : undefined,
    size,
    format,
    model,
  });

  return { image, raw: { executorOutput: last } };
}

/**
 * EXECUTE tool：用于 PLAN 模式执行计划并生成图片（多 agent 架构中的一个 tool）
 */
export const executeImageTool = tool(
  async ({ prompt, context, image, plan, output }) => {
    const { image: generated } = await executeImagePlan({
      prompt,
      context,
      image,
      plan,
      output,
    });
    return JSON.stringify(generated);
  },
  {
    name: "execute_image",
    description: "根据已确认的 plan 执行图片生成，返回图片（JSON）。",
    schema: z.object({
      prompt: z.string().describe("用户最新诉求（可用于覆盖/补充计划）"),
      context: z.string().optional().describe("补充上下文（可选）"),
      image: z
        .object({
          url: z.string().optional(),
          base64: z.string().optional(),
          mimeType: z.string().optional(),
        })
        .optional()
        .describe("参考图片（可选）"),
      plan: planSchema.describe("已确认的图片生成计划（JSON 对象）"),
      output: z
        .object({
          size: z.string().optional(),
          format: z.enum(["b64_json", "url"]).optional(),
          model: z.string().optional(),
        })
        .optional()
        .describe("输出控制（可选）"),
    }),
  }
);