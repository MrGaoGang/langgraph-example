import { createSimpleSearcherAgent } from "deep-research/src/agents/simpleSearcher";
import { createSupervisorAgent } from "deep-research/src/agents/supervisor";

// 普通搜索
const graph = createSimpleSearcherAgent();
export { graph };

// const graph = createSupervisorAgent(false);
// export { graph };
