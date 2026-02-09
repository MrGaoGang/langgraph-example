import { createAgent } from "./agentFactory";
import { getChatModel } from "../model/chat";
import { DeepImageDecision } from "../types";

const MODE_CLASSIFIER_SYSTEM_PROMPT = `
你是 DeepImage 系统的“模式决策模块”，负责判断用户请求应该走：
- SIMPLE：一次性直接生成图片
- PLAN：先制定结构化生成计划，等待用户确认/修改后再执行

请只输出 JSON：
{
  "mode": "SIMPLE" | "PLAN",
  "reasoning": string
}

判断参考：
- 需求多、约束多、需要多轮确认/拆步骤/多个版本 → PLAN
- 需求明确、一次即可生成 → SIMPLE
`.trim();

function heuristicMode(prompt: string) {
  const p = prompt.toLowerCase();
  const keywords = [
    "plan",
    "步骤",
    "规划",
    "先给方案",
    "先给计划",
    "多轮",
    "迭代",
    "多个版本",
    "分步骤",
    "对比",
    "分别生成",
    "分镜",
  ];
  if (keywords.some((k) => p.includes(k))) return "PLAN";
  if (prompt.length >= 120) return "PLAN";
  return undefined;
}

export async function decideMode(params: {
  prompt: string;
  context?: string;
  hasPlan?: boolean;
}): Promise<DeepImageDecision> {
  if (params.hasPlan) {
    return { mode: "PLAN", reasoning: "检测到已提供 plan，进入 PLAN 执行流程。" };
  }

  const heuristic = heuristicMode(params.prompt);
  if (heuristic) {
    return { mode: heuristic, reasoning: "命中启发式规则，进入 PLAN 模式。" };
  }

  const agent = createAgent({
    model: getChatModel({ temperature: 0 }),
    systemPrompt: MODE_CLASSIFIER_SYSTEM_PROMPT,
  });

  let content = `用户需求：${params.prompt}`;
  if (params.context) content += `\n\n补充上下文：\n${params.context}`;
  content += `\n\n请输出 JSON。`;

  const result = await agent.invoke({
    messages: [{ role: "user", content }],
  });

  const last = result.messages[result.messages.length - 1]?.content ?? "";

  try {
    const parsed = JSON.parse(last);
    const mode = parsed.mode === "PLAN" ? "PLAN" : "SIMPLE";
    const reasoning =
      typeof parsed.reasoning === "string" ? parsed.reasoning : "由分类器自动判断。";
    return { mode, reasoning };
  } catch {
    return {
      mode: "SIMPLE",
      reasoning: last || "无法解析分类器输出，采用 SIMPLE 模式兜底。",
    };
  }
}