import { createAgent } from "./agentFactory";
import { getModel } from "../model/model";
import { SUPERVISOR_SYSTEM_PROMPT } from "../prompts/prompts";
import { planResearchTool } from "../tools/planner";
import { executeResearchTool } from "../tools/exec-researcher";
import { Agent } from "../types";
import { toolMonitoringMiddleware } from "../middleware/monitoring";
import { MemorySaver } from "@langchain/langgraph";
import { AgentMiddleware, humanInTheLoopMiddleware } from "langchain";

// Singleton checkpointer to persist state across requests
const checkpointer = new MemorySaver();

/**
 * 创建 Supervisor Agent
 * 协调 Planner 和 Researcher 的工作，管理整体研究流程
 */
export function createSupervisorAgent(humanInTheLoop: boolean = true): Agent {
  const model = getModel({ temperature: 0.3 });

  const middleware: AgentMiddleware[] = [toolMonitoringMiddleware];
  if (humanInTheLoop) {
    middleware.push(
      humanInTheLoopMiddleware({
        interruptOn: {
          plan_research: true, // All decisions (approve, edit, reject) allowed
          // execute_research: {
          //   allowedDecisions: ["edit", "reject"],
          // },
          execute_research: true,
        },
        // Prefix for interrupt messages - combined with tool name and args to form the full message
        // e.g., "Tool execution pending approval: execute_sql with query='DELETE FROM...'"
        // Individual tools can override this by specifying a "description" in their interrupt config
        descriptionPrefix: "Tool execution pending approval",
      })
    );
  }
  // 创建 Supervisor Agent，配备两个子 Agent 工具
  return createAgent({
    model,
    tools: [planResearchTool, executeResearchTool],
    systemPrompt: SUPERVISOR_SYSTEM_PROMPT,
    middleware: middleware,
    checkpointer: checkpointer as any,
  });
}
