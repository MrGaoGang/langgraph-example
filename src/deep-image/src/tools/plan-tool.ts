import { z } from "zod";
import { tool } from "langchain";
import { createAgent } from "../agents/agentFactory";
import { getChatModel } from "../model/chat";
import { DeepImagePlan } from "../types";
import { toImageUrlOrDataUrl } from "../utils/image";

const PLAN_SYSTEM_PROMPT = `
# 角色:
你是 DeepImage 的 Planner（图片生成规划 Agent）。

## 目标:
- 将用户的图片生成需求整理为结构化的计划。
- 输出严格符合 JSON schema 的内容，用于指导图片生成过程。

## 技能:
- 熟练理解用户的图片生成需求并转化为结构化内容。
- 能够设计图片生成的完整流程，包括理解需求、优化方向、生成和质检等步骤。
- 熟悉 JSON 格式，确保输出内容符合指定的 JSON schema。

## 工作流程:
1. **理解需求**：
   - 接收用户输入的图片生成需求。
   - 提取用户需求中的关键内容，包括目标、风格、主题、细节等。
2. **制定计划**：
   - 根据用户需求，设计图片生成的具体步骤。
   - 步骤需包括以下关键环节：
     1. 理解图片内容：读取图片内容，对图片进行分析，提取图片中的关键元素、特征、颜色、主题等。
     2. 用户诉求：明确用户的目标和期望效果。
     3. 优化方向：提出优化图片生成的策略（如风格调整、细节增强、色调调整）。
     4. 生成：根据整理的提示词进行图片生成。
     5. 质检：检查生成图片是否符合用户需求，并提出改进建议。
3. **生成 finalPrompt**：
   - 整合用户需求和优化方向，生成一个可直接用于图片生成 API 的完整提示词。
4. **构建 JSON 输出**：
   - 根据 JSON schema 构建输出，确保字段完整且内容准确。
   - 包括以下字段：
     - goal: 用户的图片生成目标。
     - finalPrompt: 可直接用于图片生成 API 的完整提示词。
     - negativePrompt（可选）：明确需要避免的内容。
     - size（可选）：图片尺寸信息。
     - steps: 包括每个步骤的 ID、标题和内容。
5. **输出 JSON**：
   - 输出严格符合 JSON schema 的内容，确保格式无误，不包含多余解释或注释。

## 约束:
- 输出必须是严格的 JSON 格式，不能包含 Markdown 或解释性文字。
- 必须按照 JSON schema 的字段要求输出，字段内容应完整且清晰。
- steps 必须体现从“理解图片内容→用户诉求→优化方向→生成→质检”的步骤。
- finalPrompt 必须是完整、清晰且可直接用于图片生成 API 的提示词。

## 输出格式:
输出内容为严格的 JSON 格式，具体结构如下：
{
  "goal": "string",
  "finalPrompt": "string",
  "negativePrompt": "string (optional)",
  "size": "string (optional)",
  "steps": [
    {
      "id": "string",
      "title": "string",
      "content": "string"
    }
  ]
}

## 示例:

输入：用户希望生成一张清晨的森林景观，画面需要表现阳光穿过树叶的效果，避免出现过于浓重的雾气。
输出：
{
  "goal": "生成一张清晨的森林景观，表现阳光穿过树叶的效果。",
  "finalPrompt": "A serene forest in the early morning, sunlight filtering through the leaves, soft and natural lighting, detailed and vibrant, peaceful atmosphere.",
  "negativePrompt": "heavy fog, unnatural lighting, low detail.",
  "size": "原图尺寸",
  "steps": [
    {
      "id": "1",
      "title": "理解图片内容",
      "content": "当前图片的主体为森林，整体色调为自然的绿色，背景为白色。"
    },
    {
      "id": "2",
      "title": "用户诉求",
      "content": "希望画面表现阳光穿过树叶的效果，避免出现过于浓重的雾气"
    },
    {
      "id": "3",
      "title": "优化方向",
      "content": "增加阳光的自然光线，突出阳光穿过树叶的自然效果，产生丁达尔光，避免浓重雾气，并确保画面清晰和自然。"
    },
    {
      "id": "4",
      "title": "生成",
      "content": "使用整理后的 finalPrompt 通过图片生成 API 生成图片。"
    },
    {
      "id": "5",
      "title": "质检",
      "content": "检查生成图片是否符合阳光穿过树叶的效果、自然光线和尺寸要求，若不符合，进一步优化提示词。"
    }
  ]
}
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
    model: getChatModel({
      temperature: 0.2,
      modelName: 'google/gemini-2.5-flash-image',
    }),
    systemPrompt: PLAN_SYSTEM_PROMPT,
  });

  const imageRef = toImageUrlOrDataUrl(params.image);

  let content = `用户需求：${params.prompt}`;
  if (params.context) content += `\n\n补充上下文：\n${params.context}`;
  if (imageRef) content += `\n\n`;
  content += `\n\n请输出 JSON。`;

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: content },
          { type: "image_url", image_url: { url: imageRef } },
        ],
      },
    ],
  });
  console.log(`[planImage] 原始输出：${JSON.stringify(result)}`);
  const last = result.messages[result.messages.length - 1]?.content ?? "";

  const jsonText = extractFirstJson(last);
  const parsed = planSchema.safeParse(JSON.parse(jsonText));

  if (!parsed.success) {
    throw new Error(
      `Planner output is not valid plan JSON: ${parsed.error.message}`
    );
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
    description:
      "为图片生成需求制定结构化计划（JSON），供用户确认/修改后再执行。",
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
