import { createAgent } from "./agentFactory";
import { getModel } from "../model/model";
import { SIMPLE_SEARCHER_SYSTEM_PROMPT } from "../prompts/prompts";
import { tavilySearchTool } from "../tools/webTools";
import { Agent } from "../types";
import { toolMonitoringMiddleware } from "../middleware/monitoring";

/**
 * Simple Searcher：轻量级 ReAct Agent，只挂载搜索工具。
 */
export function createSimpleSearcherAgent(): Agent {
  return createAgent({
    model: getModel({ temperature: 0.1 }),
    tools: [tavilySearchTool], // 仅搜索
    systemPrompt: SIMPLE_SEARCHER_SYSTEM_PROMPT,
    middleware: [toolMonitoringMiddleware],
  });
}