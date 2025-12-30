# LangGraph Examples

This repository contains various examples and implementations using LangGraph, LangChain, and related technologies.

## Prerequisites

Before running any examples, please create a `.env` file in the root directory with your API keys:

```bash
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
# Add other keys as needed by specific subprojects (e.g., TAVILY_API_KEY, OPENROUTER_API_KEY)
```

## Project Structure

The `src` directory contains several subprojects:

### 1. Deep Research Agent
**Path:** `src/deep-research`

A "Deep Research" Agent wrapper based on LangChain (TS). It supports `SIMPLE`, `DEEP`, and `AUTO` modes, providing both one-time results and streaming output.

- **Features:** Auto-mode selection, structured research reports, streaming support.
- **More Info:** See [src/deep-research/README.md](./src/deep-research/README.md)

### 2. LangGraph AG-UI
**Path:** `src/langgraph-agui`

A local Agent example using CopilotKit + LangGraph + Next.js. It demonstrates how to run a local agent within a Next.js service without relying on `langgraph-cli`.

- **Features:** Frontend tool usage, Human-in-the-loop, Agent runtime visualization.
- **More Info:** See [src/langgraph-agui/README.md](./src/langgraph-agui/README.md)

### 3. LangGraph MCP
**Path:** `src/langgrah_mcp`

A demo integrating LangGraph with the Model Context Protocol (MCP).

- **Description:** Sets up a Koa server and demonstrates an MCP Client connecting to a custom MCP Server to execute tools (e.g., getting weather and calculating).
- **Run:**
  ```bash
  # Install dependencies
  pnpm install
  # Run the example
  npx tsx src/langgrah_mcp/index.ts
  ```

### 4. LangGraph CLI
**Path:** `src/langgraph-cli`

Configuration and scripts for using the LangGraph CLI.

### 5. LangGraph Patterns
**Path:** `src/langgraph`

A collection of standalone LangGraph pattern examples. You can run these by uncommenting the relevant lines in `src/langgraph/index.ts` and running the file.

**Available Examples:**

- **Simple**: Basic LangGraph usage. (`src/langgraph/simple`)
- **Condition Edge**: Using conditional edges. (`src/langgraph/condition-edge`)
- **Condition Edge Pro**: Conditional edges with parallel nodes. (`src/langgraph/condition-edge-pro`)
- **Send Parallel**: Using `send` for parallel tasks. (`src/langgraph/send-parallel`)
- **Send Loop**: Using `send` for looping tasks. (`src/langgraph/send-loop`)
- **Tool Node**: Task scheduling based on Tool Node. (`src/langgraph/tool-node`)
- **CreateReactAgent**: Task scheduling based on `createReactAgent`. (`src/langgraph/workflow-single-use-muti-agent`)
- **Plan & Execute (Default)**: Official Plan-and-Execute agent. (`src/langgraph/plan_execute_agent_default`)
- **Plan & Execute (Custom)**: Custom Plan-and-Execute agent implementation. (`src/langgraph/plan_execute_agent_custom`)
- **Plan & Execute (Limit)**: Custom Plan-and-Execute agent with max retry limits. (`src/langgraph/plan_execute_agent_custom_task_limit`)

**How to Run:**
1. Open `src/langgraph/index.ts`.
2. Uncomment the example you want to run.
3. Run:
   ```bash
   npx tsx src/langgraph/index.ts
   ```
