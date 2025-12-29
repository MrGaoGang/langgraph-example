import { Command } from "@langchain/langgraph";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { DeepResearchToolName } from "deep-research/src/index";
import type { DeepResearchContext } from "./deep-research-agent";
import { Message } from "@ag-ui/client";
import logger from "../utils/logger";

export type ToolActionHandler = (
  context: DeepResearchContext,
  toolName: DeepResearchToolName,
  userLastMsg: Message,
  aiLastMsg: AIMessage | ToolMessage
) => Promise<void>;

// plan_research 策略：简单确认，把前端决策类型喂回去
const planResearchHandler: ToolActionHandler = async (
  context,
  _toolName,
  userLastMsg
) => {
  const { agent, config } = context;
  if (!agent || !config) return;

  if (userLastMsg?.role !== "tool") return;

  logger.info("DEBUG: planResearchHandler userLastMsg: ", userLastMsg);
  context.inputStream = await agent.streamEvents(
    new Command({
      resume: { decisions: [{ type: userLastMsg.content }] },
    }),
    config
  );
};

// execute_research 策略：支持 reject + edit/confirm
const executeResearchHandler: ToolActionHandler = async (
  context,
  toolName,
  userLastMsg,
  aiLastMsg
) => {
  const { agent, config } = context;
  if (!agent || !config) return;

  // 1. 拒绝场景：直接把 reject 决策喂回去
  if (userLastMsg?.role === "tool" && userLastMsg.content === "reject") {
    logger.info("DEBUG: executeResearchHandler tools reject: ", userLastMsg);
    context.inputStream = await agent.streamEvents(
      new Command({
        resume: { decisions: [{ type: userLastMsg.content }] },
      }),
      config
    );
    return;
  }

  // 2. 编辑/确认场景：
  // - 前端以 tool 消息回传 JSON 参数时，优先使用前端编辑后的内容
  // - 否则退回到 AI 上一次 tool_call 的原始 args
  const isToolDecision = userLastMsg?.role === "tool";
  logger.info("DEBUG: executeResearchHandler isToolDecision: ", isToolDecision);
  const editedArgs = isToolDecision
    ? JSON.parse(userLastMsg.content)
    : aiLastMsg?.tool_calls?.[0]?.args ?? {};

  const command = {
    type: "edit" as const,
    editedAction: {
      name: toolName,
      args: editedArgs,
    },
  };

  context.inputStream = await agent.streamEvents(
    new Command({
      resume: {
        decisions: [command],
      },
    }),
    config
  );
};

// 工厂内部的“注册表”：相当于策略模式里的策略集合
const TOOL_ACTION_HANDLER_REGISTRY: Record<string, ToolActionHandler> = {
  [DeepResearchToolName.PlanResearch]: planResearchHandler,
  [DeepResearchToolName.ExecuteResearch]: executeResearchHandler,
};

// 工厂方法：根据工具名返回对应的 handler（策略）
export function getToolActionHandler(
  toolName: DeepResearchToolName
): ToolActionHandler | undefined {
  return TOOL_ACTION_HANDLER_REGISTRY[String(toolName)];
}
