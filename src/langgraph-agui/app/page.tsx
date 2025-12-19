"use client";

import "./globals.css";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useAgent } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { useColorChange } from "./hooks/color-change";
import { useCountChange } from "./hooks/count-change";
import { FrontendCounterSection } from "./componentts/FrontendCounterSection";
import { useHumanInTheLoopHooks } from "./hooks/human_in_the_loop";

export default function HomePage() {
  const { agent } = useAgent({
    agentId: "ts_graph_agent",
  });

  // 颜色变化
  useColorChange();

  // 计数器变化
  const counter = useCountChange();

  // 可人类中断步骤的
  useHumanInTheLoopHooks();

  return (
    <CopilotSidebar
      defaultOpen={true}
      suggestions={[
        {
          title: "把计数器改成 5",
          message: "把计数器改成 5",
        },
        {
          title: "把背景颜色改成红色",
          message: "把背景颜色改成红色",
        },
        {
          title: "Please plan a trip to mars in 5 steps.",
          message: "Please plan a trip to mars in 5 steps.",
        },
      ]}
      instructions="你是一个示例助手，帮助用户体验 LangGraph + Next.js + CopilotKit 集成，可以主动调用前端工具 update_counter 来更新 UI 中的计数器，并在需要时触发 LangGraph interrupt 请求额外输入。"
    >
      <div className="app-root">
        <div className="app-card">
          <div className="badge">
            <span className="badge-dot" />
            LangGraph + Next.js + CopilotKit
          </div>
          <h1 className="app-title">全栈集成示例（TypeScript）</h1>
          <p className="app-subtitle">
            右侧的 Copilot 侧边栏通过 AG-UI 协议连接到本地 LangGraph
            graph（ts_graph_agent）。
          </p>

          <FrontendCounterSection counter={counter} />

          <div className="app-grid app-section" style={{ marginTop: 16 }}>
            <div>
              <div className="app-section-title">Agent 运行态（useAgent）</div>
              <p className="app-section-text">
                Agent ID：{agent.agentId ?? "未知"}
              </p>
              <p className="app-section-text">
                当前是否运行中：{agent.isRunning ? "是" : "否"}
              </p>
              <p className="app-section-text">
                消息数量：{agent.messages.length}
              </p>
              <p className="app-section-text">
                当前线程 ID：
                <span className="code">{agent.threadId ?? "未初始化"}</span>
              </p>
            </div>
            <div></div>
          </div>
        </div>
      </div>
    </CopilotSidebar>
  );
}
