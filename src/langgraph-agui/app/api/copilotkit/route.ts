import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { NextRequest } from "next/server";
import { CustomAgent } from "@/src/agent/custom-agent";
import { ReactLangGraphAgent } from "@/src/agent/react-langgraph-agent";
// const langgraphAgent = new CustomAgent()
const langgraphAgent = new ReactLangGraphAgent()
const runtime = new CopilotRuntime({
  agents: {
    ts_graph_agent: langgraphAgent,
  },
});

const serviceAdapter = new ExperimentalEmptyAdapter();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
