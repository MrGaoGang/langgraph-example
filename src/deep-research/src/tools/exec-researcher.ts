import { z } from "zod";
import { tool } from "langchain";
import { createAgent } from "../agents/agentFactory";
import { getModel } from "../model/model";
import { RESEARCHER_SYSTEM_PROMPT } from "../prompts/prompts";
import { Agent } from "../types";
import {
  webSearchTool,
  webExtractTool,
  webCrawlTool,
} from "./webTools";
import { toolMonitoringMiddleware } from "../middleware/monitoring";

export function createResearcherAgent(): Agent {
  const model = getModel({ temperature: 0.4 });
  return createAgent({
    model,
    tools: [webSearchTool, webExtractTool, webCrawlTool],
    systemPrompt: RESEARCHER_SYSTEM_PROMPT,
    middleware: [toolMonitoringMiddleware],
  });
}

/**
 * 执行调研计划的工具。
 */
export const executeResearchTool = tool(
  async ({ plan, context }) => {
    try {
      const researcherAgent = createResearcherAgent();

      let requestText = "下面是需要执行的调研计划（JSON）：\n";
      requestText += plan;

      if (context) {
        requestText += `\n\n补充上下文：\n${context}`;
      }

      const result = await researcherAgent.invoke({
        messages: [{ role: "user", content: requestText }],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      return lastMessage.content;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `执行调研失败: ${errorMessage}`;
    }
  },
  {
    name: "execute_research",
    description: `
根据 plan_research 工具生成的调研计划，逐步调用网络工具执行调研。

输入：
- plan: 结构化调研计划（JSON）
- context: 额外上下文信息（可选）

输出：
- 每个步骤的关键信息总结
- 引用来源
- 最终的阶段性研究结论
`.trim(),
    schema: z.object({
      plan: z
        .string()
        .describe("plan_research 工具生成的 JSON 格式调研计划"),
      context: z
        .string()
        .optional()
        .describe("调研的额外背景信息（可选）"),
    }),
  }
);