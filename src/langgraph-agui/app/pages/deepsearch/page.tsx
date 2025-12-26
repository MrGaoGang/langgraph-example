"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import { useAgent } from "@copilotkit/react-core/v2";
import "./style.css";
import "@copilotkit/react-ui/styles.css";

export default function HomePage() {
  const { agent } = useAgent({
    agentId: "deepsearch_agent",
  });

  return (
    <div style={{ width: "100%", height: "90vh" }}>
      <div
        className="app-grid app-section"
        style={{ marginBottom: 16, borderTop: "1px solid green" }}
      >
        <div>
          <div className="app-section-title">Agent 运行态（useAgent）</div>
          <p className="app-section-text">
            Agent ID：{agent.agentId ?? "未知"}
          </p>
          <p className="app-section-text">
            当前是否运行中：{agent.isRunning ? "是" : "否"}
          </p>
          <p className="app-section-text">消息数量：{agent.messages.length}</p>
          <p className="app-section-text">
            当前线程 ID：
            <span className="code">{agent.threadId ?? "未初始化"}</span>
          </p>
        </div>
        <div></div>
      </div>
      <CopilotChat
        suggestions={[
          {
            title: "比较 Llama 3.1 和 GPT-4o",
            message: "比较 Llama 3.1 和 GPT-4o 在开放权重/部署成本上的差异。",
          },
          {
            title: "langchain TS 框架 最新发布的动态",
            message: "搜索一下langchain TS 框架 最新发布的动态。",
          },
        ]}
        instructions="你是一个示例助手，帮助用户体验 LangGraph + Next.js + CopilotKit 集成，可以主动调用前端工具 update_counter 来更新 UI 中的计数器，并在需要时触发 LangGraph interrupt 请求额外输入。"
      ></CopilotChat>
    </div>
  );
}
