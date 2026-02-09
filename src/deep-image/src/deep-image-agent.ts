import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  DeepImageDecision,
  DeepImageMode,
  DeepImageRequest,
  DeepImageResult,
} from "./types";
import { decideMode } from "./agents/mode-classifier";
import { runSimpleAgent } from "./agents/simple-agent";
import { getPlanGraph } from "./agents/plan-graph";

export interface DeepImageAgentConfig {
  defaultMode?: DeepImageMode;
}

export class DeepImageAgent {
  private readonly defaultMode: DeepImageMode;

  constructor(config: DeepImageAgentConfig = {}) {
    this.defaultMode = config.defaultMode ?? "AUTO";
  }

  async generate(request: DeepImageRequest): Promise<DeepImageResult> {
    const mode = request.mode ?? this.defaultMode;

    const decision: DeepImageDecision =
      mode !== "AUTO"
        ? {
            mode: mode === "PLAN" ? "PLAN" : "SIMPLE",
            reasoning: "用户显式指定模式。",
          }
        : await decideMode({
            prompt: request.prompt,
            context: request.context,
            hasPlan: Boolean(request.plan),
          });

    if (decision.mode === "SIMPLE") {
      const { image, raw } = await runSimpleAgent(request);
      return {
        type: "image",
        mode: "SIMPLE",
        decision,
        image,
        raw,
      };
    }

    // PLAN：LangGraph 流程
    const graph = await getPlanGraph();
    const out = await graph.invoke({ request, decision });

    if (!out.result) {
      throw new Error("PLAN 图执行完成但 result 为空");
    }
    return out.result;
  }
}
