# deep-research

一个基于 LangChain（TS）的“深度调研”Agent 封装：支持 `SIMPLE / DEEP / AUTO` 三种模式，提供一次性返回结果与流式输出两种调用方式。

## 功能概览

- `AUTO`：先由 `Classifier` 自动决策走 `SIMPLE` 还是 `DEEP`，并给出建议深度
- `SIMPLE`：快速检索并给出简明答案（偏“快”）
- `DEEP`：Supervisor 协调 Planner/Researcher，输出结构化调研报告（偏“深”）
- `research()`：一次性返回最终结果
- `researchStream()`：流式返回（适合前端逐步展示）

## 环境要求

- Node.js 18+（本项目在 `webTools.ts` 使用了 `fetch`）
- 包管理：`pnpm`（本目录包含 `pnpm-lock.yaml`）

## 配置环境变量

项目默认使用：
- OpenRouter 作为大模型网关（见 `src/model/model.ts`）
- Tavily 作为联网搜索/抽取/爬取能力（见 `src/tools/webTools.ts`）

建议在 `src/deep-research/` 下创建 `.env`：

```bash
OPENROUTER_API_KEY=your_openrouter_key
TAVILY_API_KEY=your_tavily_key
```

> 示例代码里已使用 `import "dotenv/config";` 自动加载环境变量。

## 安装依赖

在 `src/deep-research/` 目录执行：

```bash
pnpm install
```

## 运行示例

示例位于 `example/`：

- `example/example-deep-research-usage.ts`：一次性返回结果
- `example/example-deep-research-stream.ts`：流式输出

> 运行方式取决于你在仓库里使用的 TypeScript 执行器（例如 `tsx`/`ts-node` 或构建后再运行）。  
> 如果你在根仓库已有统一脚本，直接按你的脚本运行这两个文件即可。

## 快速上手（代码片段）

### 1) 一次性返回结果

```ts
import "dotenv/config";
import { DeepResearchAgent, type DeepResearchRequest } from "../src/index";

const agent = new DeepResearchAgent({
  verbose: true,
  defaultMode: "AUTO",
  defaultDepth: 3,
  maxDepth: 6,
});

const request: DeepResearchRequest = {
  query: "搜索一下 langchain TS 框架 最新发布的动态",
  mode: "AUTO",
  context: "面向一个要写技术白皮书的工程团队。",
};

const result = await agent.research(request);
console.log(result.mode, result.depth);
console.log(result.output);
```

### 2) 流式输出

```ts
import "dotenv/config";
import { DeepResearchAgent, type DeepResearchRequest } from "../src/index";

const agent = new DeepResearchAgent();

const request: DeepResearchRequest = {
  query: "比较 Llama 3.1 和 GPT-4o 在开放权重/部署成本上的差异。",
  mode: "AUTO",
};

for await (const chunk of agent.researchStream(request)) {
  console.log(`[${chunk.type}]`, chunk.content);
}
```

`chunk.type` 可能值（见 `src/types.ts`）：
- `thinking`
- `intermediate_result`
- `final_result`
- `error`

## API 说明

### `DeepResearchAgent`

构造参数（`DeepResearchOptions`）：

- `verbose?: boolean`
- `defaultMode?: "SIMPLE" | "DEEP" | "AUTO"`（默认 `AUTO`）
- `defaultDepth?: number`（默认 `3`）
- `maxDepth?: number`（默认 `6`）

主要方法：

- `research(request: DeepResearchRequest): Promise<DeepResearchResult>`
- `researchStream(request: DeepResearchRequest): AsyncIterable<ResearchStreamChunk>`

### `DeepResearchRequest`

- `query: string`：问题
- `mode?: "SIMPLE" | "DEEP" | "AUTO"`：指定模式（可选）
- `depth?: number`：研究深度（仅 `DEEP` 有效）
- `context?: string`：额外上下文（业务背景、历史信息等）

## 目录结构

- `src/index.ts`：对外统一入口（编排、模式决策、research / researchStream）
- `src/agents/`：Classifier / SimpleSearcher / Supervisor 等 Agent 组装
- `src/tools/webTools.ts`：Tavily web search / extract / crawl 工具
- `src/model/model.ts`：模型配置（OpenRouter）
- `example/`：可运行示例

## 常见问题

- `TAVILY_API_KEY 未配置`：请检查 `.env` 是否生效、变量名是否正确
- OpenRouter 鉴权失败：检查 `OPENROUTER_API_KEY` 是否正确、是否有额度

---
License: ISC