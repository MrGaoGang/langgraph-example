import {
  DeepResearchDecision,
  DeepResearchMode,
  DeepResearchOptions,
  DeepResearchRequest,
  DeepResearchResult,
  ResearchStreamChunk,
} from "./types";
import { classifyQuery } from "./agents/classifier";
import { createSimpleSearcherAgent } from "./agents/simpleSearcher";
import { createSupervisorAgent } from "./agents/supervisor";

export interface DeepResearchAgentConfig extends DeepResearchOptions {}

/**
 * 接口层：统一对外入口。
 * - 接收标准化 DeepResearchRequest
 * - 管理模式决策和参数传递
 * - 暴露 research / researchStream 两种调用方式
 */
export class DeepResearchAgent {
  private readonly verbose: boolean;
  private readonly defaultMode: DeepResearchMode;
  private readonly defaultDepth: number;
  private readonly maxDepth: number;

  constructor(config: DeepResearchAgentConfig = {}) {
    this.verbose = config.verbose ?? false;
    this.defaultMode = config.defaultMode ?? "AUTO";
    this.defaultDepth = config.defaultDepth ?? 3;
    this.maxDepth = config.maxDepth ?? 6;
  }

  /**
   * 一次性返回完整结果。
   */
  async research(request: DeepResearchRequest): Promise<DeepResearchResult> {
    const { decision, depth } = await this.determineMode(request);
    const mode = decision.mode;

    if (mode === "SIMPLE") {
      const agent = createSimpleSearcherAgent();
      const userPrompt = this.buildSimpleSearcherPrompt(request);
      const result = await agent.invoke({
        messages: [{ role: "user", content: userPrompt }],
      });
      const last = result.messages[result.messages.length - 1];

      return {
        mode,
        depth: undefined,
        decision,
        output: last.content,
        raw: result,
      };
    } else {
      const agent = createSupervisorAgent();
      const supervisorPrompt = this.buildSupervisorPrompt(request, depth);
      const result = await agent.invoke({
        messages: [{ role: "user", content: supervisorPrompt }],
      });
      const last = result.messages[result.messages.length - 1];

      return {
        mode,
        depth,
        decision,
        output: last.content,
        raw: result,
      };
    }
  }

  /**
   * 获取研究 Agent 及相关Prompt
   * @param request 
   * @returns 
   */
  async getResearchAgent(request: DeepResearchRequest) {
    const { decision, depth } = await this.determineMode(request);
    if (decision.mode === "SIMPLE") {
      const agent = createSimpleSearcherAgent();
      const userPrompt = this.buildSimpleSearcherPrompt(request);
      return { agent, userPrompt };
    } else {
      const agent = createSupervisorAgent();
      const userPrompt = this.buildSupervisorPrompt(request, depth);
      return { agent, userPrompt };
    }
  }

  /**
   * 流式返回，适合前端逐步展示思考过程与中间结果。
   */
  async *researchStream(
    request: DeepResearchRequest
  ): AsyncIterable<ResearchStreamChunk> {
    const { decision, depth } = await this.determineMode(request);
    const mode = decision.mode;

    yield {
      type: "thinking",
      content:
        mode === "SIMPLE"
          ? "已选择 SIMPLE 模式，执行快速搜索…"
          : `已选择 DEEP 模式，计划深度为 ${depth ?? "默认"}…`,
      metadata: { decision },
    };

    if (mode === "SIMPLE") {
      const agent = createSimpleSearcherAgent();
      const userPrompt = this.buildSimpleSearcherPrompt(request);

      if (!agent.stream) {
        const result = await agent.invoke({
          messages: [{ role: "user", content: userPrompt }],
        });
        const last = result.messages[result.messages.length - 1];
        yield {
          type: "final_result",
          content: last.content,
          metadata: { mode, decision },
        };
        return;
      }

      const stream = await agent.stream({
        messages: [{ role: "user", content: userPrompt }],
      });
      for await (const chunk of stream) {
        yield {
          type: "intermediate_result",
          content: chunk,
          metadata: { mode },
        };
      }
    } else {
      const agent = createSupervisorAgent();
      const supervisorPrompt = this.buildSupervisorPrompt(request, depth);

      if (!agent.stream) {
        const result = await agent.invoke({
          messages: [{ role: "user", content: supervisorPrompt }],
        });
        const last = result.messages[result.messages.length - 1];
        yield {
          type: "final_result",
          content: last.content,
          metadata: { mode, decision, depth },
        };
        return;
      }

      const stream = await agent.stream({
        messages: [{ role: "user", content: supervisorPrompt }],
      });

      for await (const chunk of stream) {
        yield {
          type: "intermediate_result",
          content: chunk,
          metadata: { mode, depth },
        };
      }
    }
  }

  /**
   * 编排层：决定最终模式，并将 depth 等参数标准化。
   */
  private async determineMode(
    request: DeepResearchRequest
  ): Promise<{ decision: DeepResearchDecision; depth?: number }> {
    const userMode = request.mode ?? this.defaultMode;

    // 用户显式指定 SIMPLE / DEEP，直接走对应路径
    if (userMode === "SIMPLE" || userMode === "DEEP") {
      const depth =
        userMode === "DEEP"
          ? this.normalizeDepth(undefined, request.depth)
          : undefined;

      const decision: DeepResearchDecision = {
        mode: userMode,
        suggestedDepth: depth,
        reasoning: "Mode determined by user configuration.",
      };

      return { decision, depth };
    }

    // AUTO 模式：调用决策层 Classifier Agent
    const decision = await classifyQuery({
      query: request.query,
      context: request.context,
    });

    const depth =
      decision.mode === "DEEP"
        ? this.normalizeDepth(decision.suggestedDepth, request.depth)
        : undefined;

    return {
      decision: { ...decision, suggestedDepth: depth },
      depth,
    };
  }

  private normalizeDepth(
    suggested?: number,
    explicit?: number
  ): number | undefined {
    const base = explicit ?? suggested ?? this.defaultDepth;
    if (!base) return undefined;
    const clamped = Math.max(2, Math.min(this.maxDepth, base));
    return clamped;
  }

  private buildSimpleSearcherPrompt(request: DeepResearchRequest): string {
    let prompt = `请使用网络搜索工具，对下面的问题进行一次高效、快速的检索并给出简明答案。\n\n问题：${request.query}`;

    if (request.context) {
      prompt += `\n\n补充上下文：\n${request.context}`;
    }

    return prompt;
  }

  private buildSupervisorPrompt(
    request: DeepResearchRequest,
    depth?: number
  ): string {
    let prompt = `下面是一个需要深度调研的问题，请你作为 Supervisor 协调 Planner 和 Researcher，完成系统性的研究，并最终输出结构化的研究报告。\n\n问题：${request.query}`;

    if (request.context) {
      prompt += `\n\n补充上下文：\n${request.context}`;
    }

    if (depth) {
      prompt += `\n\n期望的研究深度（步骤/轮次，可灵活调整）：${depth}`;
    }

    return prompt;
  }
}

// 便于外部直接复用类型
export * from "./types";
