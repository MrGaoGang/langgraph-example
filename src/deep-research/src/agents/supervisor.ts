import { createAgent } from "./agentFactory";
import { getModel } from "../model/model";
import { SUPERVISOR_SYSTEM_PROMPT } from "../prompts/prompts";
import { planResearchTool } from "../tools/planner";
import { executeResearchTool } from "../tools/exec-researcher";
import { Agent } from "../types";
import { toolMonitoringMiddleware } from "../middleware/monitoring";

/**
 * 创建 Supervisor Agent
 * 协调 Planner 和 Researcher 的工作，管理整体研究流程
 */
export function createSupervisorAgent(): Agent {
  const model = getModel({ temperature: 0.3 });

  // 创建 Supervisor Agent，配备两个子 Agent 工具
  return createAgent({
    model,
    tools: [planResearchTool, executeResearchTool],
    systemPrompt: SUPERVISOR_SYSTEM_PROMPT,
    middleware: [toolMonitoringMiddleware],
  });
}