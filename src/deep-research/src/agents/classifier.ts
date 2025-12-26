import { createAgent } from "./agentFactory";
import { getModel } from "../model/model";
import { CLASSIFIER_SYSTEM_PROMPT } from "../prompts/prompts";
import {
  Agent,
  DeepResearchDecision,
} from "../types";

export function createClassifierAgent(): Agent {
  const model = getModel({ temperature: 0 });
  return createAgent({
    model,
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
  });
}

/**
 * 对用户 Query 做复杂度分类，返回决策结果。
 */
export async function classifyQuery(params: {
  query: string;
  context?: string;
}): Promise<DeepResearchDecision> {
  const agent = createClassifierAgent();

  let content = `用户问题：${params.query}`;
  if (params.context) {
    content += `\n\n补充上下文：\n${params.context}`;
  }
  content += `
请根据上面的信息，按照系统提示，仅输出 JSON。`;

  const result = await agent.invoke({
    messages: [{ role: "user", content }],
  });

  const last = result.messages[result.messages.length - 1];

  try {
    const parsed = JSON.parse(last.content);
    const mode =
      parsed.mode === "DEEP" ? "DEEP" : "SIMPLE";

    const suggestedDepth =
      typeof parsed.suggestedDepth === "number"
        ? parsed.suggestedDepth
        : undefined;

    const reasoning =
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "由分类器自动判断。";

    return {
      mode,
      suggestedDepth,
      reasoning,
    };
  } catch {
    // 解析失败时的保守兜底策略
    return {
      mode: "SIMPLE",
      suggestedDepth: 2,
      reasoning: last.content || "无法解析分类器输出，采用 SIMPLE 模式兜底。",
    };
  }
}