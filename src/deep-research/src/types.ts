import { createAgent } from "langchain";

export type DeepResearchMode = "SIMPLE" | "DEEP" | "AUTO";

export interface DeepResearchRequest {
  query: string;
  /**
   * 用户显式指定的模式，如果没有则走默认或 AUTO。
   */
  mode?: DeepResearchMode;
  /**
   * 期望的研究深度（仅在 Deep 模式下有效）。
   */
  depth?: number;
  /**
   * 研究的额外上下文，例如业务背景、历史对话等。
   */
  context?: string;
}

export interface DeepResearchOptions {
  verbose?: boolean;
  /**
   * 默认模式，未指定时使用 AUTO。
   */
  defaultMode?: DeepResearchMode;
  /**
   * Deep 模式的默认深度。
   */
  defaultDepth?: number;
  /**
   * Deep 模式能使用的最大深度上限。
   */
  maxDepth?: number;
}

export interface DeepResearchDecision {
  mode: Exclude<DeepResearchMode, "AUTO">;
  suggestedDepth?: number;
  reasoning: string;
}

export interface DeepResearchResult {
  /**
   * 最终采用的执行模式。
   */
  mode: Exclude<DeepResearchMode, "AUTO">;
  /**
   * 实际使用的研究深度（仅 Deep 模式）。
   */
  depth?: number;
  /**
   * 决策层给出的结构化决策结果。
   */
  decision: DeepResearchDecision;
  /**
   * 聚合后的最终输出文本。
   */
  output: string;
  /**
   * 底层 Agent 返回的原始结构，方便调试。
   */
  raw?: unknown;
}

export type ResearchStreamChunkType =
  | "thinking"
  | "intermediate_result"
  | "final_result"
  | "error";

export interface ResearchStreamChunk {
  type: ResearchStreamChunkType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface AgentInvokeInput {
  messages: AgentMessage[];
  context?: string;
}

export interface AgentResult {
  messages: AgentMessage[];
}

export type Agent  = ReturnType<typeof createAgent>