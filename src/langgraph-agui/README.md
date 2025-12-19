# CopilotKit + LangGraph 本地 Agent 示例（Next.js 单进程，无需 langgraph-cli）

这是一个可运行的 TypeScript 示例项目，演示如何在 **不依赖 `langgraph-cli` / `langgraph dev`** 的前提下，将：

- **Next.js (App Router)** 作为前后端一体化运行时
- **CopilotKit Runtime** 作为 AG-UI 协议运行时（`/api/copilotkit`）
- **LangGraph.js（createReactAgent）** 作为本地 Agent 执行器（在 Next.js 进程内运行）
- **CopilotKit React UI** 作为最小 Agentic UI（右侧 `CopilotSidebar`）

组合成一个单独的 Next.js 服务，直接托管本地 Agent。

---

## 你能体验到什么（本项目跑通能力）

### 1) Agent 驱动前端工具（useFrontendTool）
在聊天里输入类似：

- `把计数器改成 5` → Agent 会调用前端工具 `update_counter`，页面计数器同步更新（0~100）
- `把背景颜色改成红色` → Agent 会调用前端工具 `changeBackgroundColor`，页面背景色变化

对应代码：
- `app/hooks/count-change.tsx`：`update_counter`
- `app/hooks/color-change.ts`：`changeBackgroundColor`

### 2) Human-in-the-loop（useHumanInTheLoop）
在聊天里输入：

- `Please plan a trip to mars in 5 steps.`

Agent 会输出步骤，并触发前端的 HITL UI 组件来展示/反馈步骤（`StepsFeedback`）。

对应代码：
- `app/hooks/human_in_the_loop.tsx`：`generate_task_steps`
- `app/componentts/StepsFeedback.tsx`：步骤反馈 UI

### 3) 运行态可视化（useAgent v2）
页面会展示：
- `agentId`、`isRunning`、`messages.length`、`threadId`

对应代码：
- `app/page.tsx`

---

## 项目结构（关键文件）

- 前端入口：
  - `app/layout.tsx`：`<CopilotKit runtimeUrl="/api/copilotkit" agent="ts_graph_agent">`
  - `app/page.tsx`：`CopilotSidebar` + hooks 串联
- 后端入口：
  - `app/api/copilotkit/route.ts`：CopilotRuntime + 本地 agent 注册
- Agent 实现（两种示例实现方式）：
  - `src/agent/react-langgraph-agent.ts`：LangGraph `createReactAgent` + `ChatOpenAI`（当前默认使用）
  - `src/agent/custom-agent.ts`：用 OpenAI SDK 自己实现 `AbstractAgent`（可选替换）

---

## 安装与运行

### 1) 环境要求
- Node.js `>= 20`
- 推荐 `pnpm`

### 2) 安装依赖
```bash
pnpm install
```

### 3) 配置环境变量（新建/修改根目录 `.env`）
项目根目录当前有 `.env`，你可以直接编辑它；如果没有就新建一个。

#### A. 默认（ReactLangGraphAgent / OpenRouter）
`src/agent/react-langgraph-agent.ts` 当前写死走 OpenRouter：
- `baseURL: "https://openrouter.ai/api/v1"`
- `apiKey: process.env.OPENROUTER_API_KEY`
- `modelName: "openai/gpt-4o"`

因此你需要：
```env
OPENROUTER_API_KEY=your_openrouter_key
```

> 如果你后续想改回直连 OpenAI（`OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`），需要同时调整 `src/agent/react-langgraph-agent.ts` 里的 `ChatOpenAI` 初始化逻辑。

#### B. 可选（切换为 CustomAgent / OpenAI SDK）
`src/agent/custom-agent.ts` 走 OpenAI SDK，支持：
- `OPENAI_API_KEY`（必填）
- `OPENAI_BASE_URL`（可选，比如代理/私有网关）
- `OPENAI_MODEL`（可选，默认 `gpt-4o-mini`）

示例：
```env
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=https://api.openai.com/v1
```

### 4) 启动开发服务器
```bash
pnpm run dev
```

打开：
- http://localhost:3000

---

## 如何切换 Agent（ReactLangGraphAgent / CustomAgent）

当前 API Route（`app/api/copilotkit/route.ts`）默认是：

- `ts_graph_agent` → `new ReactLangGraphAgent()`

如果你想换成 `CustomAgent`，把 `langgraphAgent` 改成 `new CustomAgent()` 并确保 `.env` 配好了 `OPENAI_API_KEY`。

文件位置：
- `app/api/copilotkit/route.ts`

---

## 交互示例（建议直接复制到右侧聊天框）

- 前端工具（计数器）：
  - `把计数器改成 5`
- 前端工具（背景色）：
  - `把背景颜色改成红色`
- HITL（步骤反馈）：
  - `Please plan a trip to mars in 5 steps.`

---

## 常见问题（Troubleshooting）

- 右侧 Copilot 无响应 / 500：
  - 检查 `.env` 是否配置了正确的 key（默认是 `OPENROUTER_API_KEY`）
- 工具不触发：
  - 确认页面已经加载并执行了 hooks：
    - `useCountChange()` / `useColorChange()` / `useHumanInTheLoopHooks()` 都在 `app/page.tsx` 里启用了
- 想看到工具参数校验：
  - `update_counter` 只允许 `0~100` 的整数（`app/hooks/count-change.tsx`）

---

## 总结

这个项目是一个“Next.js 单进程托管 Agent”的最小可运行骨架：

- CopilotKit 前端（AG-UI）⇄ Next.js API Route（CopilotRuntime）⇄ 本地 Agent（LangGraph 或自定义实现）
- 支持：
  - 前端工具调用（直接驱动 UI 状态）
  - Human-in-the-loop 交互式反馈 UI
  - Agent 运行态可视化（threadId / isRunning / messages）

你可以在此基础上继续加业务工具、状态持久化、长流程编排等能力。