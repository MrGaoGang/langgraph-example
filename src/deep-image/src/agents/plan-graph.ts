import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { DeepImageDecision, DeepImageRequest, DeepImageResult } from "../types";
import { planImageTool } from "../tools/plan-tool";
import { executeImageTool } from "../tools/execute-tool";

const DeepImageGraphState = Annotation.Root({
  request: Annotation<DeepImageRequest>({
    reducer: (_prev, next) => next,
    default: () => ({ prompt: "" }),
  }),
  decision: Annotation<DeepImageDecision>({
    reducer: (_prev, next) => next,
    default: () => ({ mode: "PLAN", reasoning: "" }),
  }),
  result: Annotation<DeepImageResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

let compiledPlanGraph: any | null = null;

export async function getPlanGraph(): Promise<any> {
  if (compiledPlanGraph) return compiledPlanGraph;

  const graph = new StateGraph(DeepImageGraphState)
    .addNode(
      "planImage",
      async (
        state: typeof DeepImageGraphState.State
      ): Promise<Partial<typeof DeepImageGraphState.State>> => {
        const planJson = await planImageTool.invoke({
          prompt: state.request.prompt,
          context: state.request.context,
          image: state.request.image,
        });

        const plan = JSON.parse(String(planJson));

        return {
          result: {
            type: "plan",
            mode: "PLAN",
            decision: state.decision,
            plan,
            raw: { planToolOutput: planJson },
          },
        };
      }
    )
    .addNode(
      "executeImage",
      async (
        state: typeof DeepImageGraphState.State
      ): Promise<Partial<typeof DeepImageGraphState.State>> => {
        if (!state.request.plan) {
          throw new Error("executeImage 节点需要 request.plan");
        }

        const imageJson = await executeImageTool.invoke({
          prompt: state.request.prompt,
          context: state.request.context,
          image: state.request.image,
          plan: state.request.plan,
          output: state.request.output,
        });

        const image = JSON.parse(String(imageJson));

        return {
          result: {
            type: "image",
            mode: "PLAN",
            decision: state.decision,
            image,
            usedPlan: state.request.plan,
            raw: { executeToolOutput: imageJson },
          },
        };
      }
    )
    .addConditionalEdges(
      START,
      (state: typeof DeepImageGraphState.State) => {
        return state.request.plan ? "executeImage" : "planImage";
      },
      ["planImage", "executeImage"]
    )
    .addEdge("planImage", END)
    .addEdge("executeImage", END);

  compiledPlanGraph = graph.compile();
  return compiledPlanGraph;
}