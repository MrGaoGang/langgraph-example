import { z } from "zod";
import { tool } from "langchain";
import { createAgent } from "../agents/agentFactory";
import { getChatModel } from "../model/chat";
import { DeepImagePlan } from "../types";
import { toImageUrlOrDataUrl } from "../utils/image";

const PLAN_SYSTEM_PROMPT = `
你是 DeepImage 的 Planner（图片生成规划 Agent）。

你需要把用户的图片生成需求整理为结构化计划，并输出严格 JSON（不要 markdown、不要解释）。

输出 JSON schema：
{
  "goal": string,
  "finalPrompt": string,
  "negativePrompt"?: string,
  "size"?: string,
  "steps": Array<{
    "id": string,
    "title": string,
    "instruction": string,
    "rationale"?: string
  }>
}

要求：
- steps 体现从“理解需求→提示词→参数→生成→质检/迭代”的步骤。
- finalPrompt 是可直接用于图片生成 API 的完整提示词。
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
      instruction: z.string(),
      rationale: z.string().optional(),
    })
  ),
});

function extractFirstJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

export async function planImage(params: {
  prompt: string;
  context?: string;
  image?: { url?: string; base64?: string; mimeType?: string };
}): Promise<{ plan: DeepImagePlan; raw?: unknown }> {
  const agent = createAgent({
    model: getChatModel({ temperature: 0.2 }),
    systemPrompt: PLAN_SYSTEM_PROMPT,
  });

  const imageRef = toImageUrlOrDataUrl(params.image);

  let content = `用户需求：${params.prompt}`;
  if (params.context) content += `\n\n补充上下文：\n${params.context}`;
  if (imageRef) content += `\n\n参考图片：${imageRef}`;
  content += `\n\n请输出 JSON。`;

  const result = await agent.invoke({ messages: [{ role: "user", content }] });
  const last = result.messages[result.messages.length - 1]?.content ?? "";

  const jsonText = extractFirstJson(last);
  const parsed = planSchema.safeParse(JSON.parse(jsonText));

  if (!parsed.success) {
    throw new Error(`Planner output is not valid plan JSON: ${parsed.error.message}`);
  }

  return { plan: parsed.data, raw: { llmOutput: last } };
}

/**
 * PLAN tool：用于 PLAN 模式生成计划（多 agent 架构中的一个 tool）
 */
export const planImageTool = tool(
  async ({ prompt, context, image }) => {
    const { plan } = await planImage({ prompt, context, image });
    return JSON.stringify(plan);
  },
  {
    name: "plan_image",
    description: "为图片生成需求制定结构化计划（JSON），供用户确认/修改后再执行。",
    schema: z.object({
      prompt: z.string().describe("用户的图片生成需求"),
      context: z.string().optional().describe("补充上下文（可选）"),
      image: z
        .object({
          url: z.string().optional(),
          base64: z.string().optional(),
          mimeType: z.string().optional(),
        })
        .optional()
        .describe("参考图片（可选）"),
    }),
  }
);