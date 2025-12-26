import "dotenv/config";

import {
  DeepResearchAgent,
  DeepResearchRequest,
} from "../src/index";

const agent = new DeepResearchAgent({
  verbose: true,
  defaultMode: "AUTO",
  defaultDepth: 3,
  maxDepth: 6,
});

const request: DeepResearchRequest = {
  query: "搜索一下langchain TS 框架 最新发布的动态",
  mode: 'AUTO',
  context: "面向一个要写技术白皮书的工程团队。",
};

async function run() {
  const result = await agent.research(request);

  console.log('==============output==============');
  console.log(result.mode, result.depth);
  console.log(result.output);
}

run();