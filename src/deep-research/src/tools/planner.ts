import { z } from "zod";
import { tool } from "langchain";
import { createAgent } from "../agents/agentFactory";
import { getModel } from "../model/model";
import { PLANNER_SYSTEM_PROMPT } from "../prompts/prompts";
import { Agent } from "../types";

export function createPlannerAgent(): Agent {
  const model = getModel({ temperature: 0.2 });
  return createAgent({
    model,
    systemPrompt: PLANNER_SYSTEM_PROMPT,
  });
}

export const planResearchTool = tool(
  async ({ request, context }) => {
    try {
      let planRequest = "";

      if (context) {
        planRequest += `## 研究背景和上下文\n${context}\n\n`;
      }

      planRequest += request;

      const plannerAgent = createPlannerAgent();
      const result = await plannerAgent.invoke({
        messages: [{ role: "user", content: planRequest }],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      return lastMessage.content;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `规划失败: ${errorMessage}`;
    }
  },
  {
    name: "plan_research",
    description: `
制定深度调研计划。

使用场景：
- 用户提出新的研究需求
- 需要将复杂问题分解为可执行步骤
- 需要系统性地规划调研方向

输入：用户的研究需求描述（自然语言）
输出：结构化的调研计划（JSON 格式），包含调研步骤、问题和预期产出

注意：调用此工具后，应根据返回的计划使用 execute_research 工具逐步执行调研。
`.trim(),
    schema: z.object({
      request: z.string().describe("用户的研究需求描述"),
      context: z
        .string()
        .optional()
        .describe("研究的额外背景信息（可选）"),
    }),
  }
);