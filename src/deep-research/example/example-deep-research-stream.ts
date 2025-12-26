import "dotenv/config";

import {
  DeepResearchAgent,
  DeepResearchRequest,
} from "../src/index";

const agent = new DeepResearchAgent();

async function runStream() {
  const request: DeepResearchRequest = {
    query: "比较 Llama 3.1 和 GPT-4o 在开放权重/部署成本上的差异。",
    mode: "AUTO",
  };

  for await (const chunk of agent.researchStream(request)) {
    console.log(`[${chunk.type}]`, chunk.content);
  }
}
 runStream();