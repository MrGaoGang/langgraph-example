import { useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core";
import { useState } from "react";
import z from "zod";

import type { ToolCallEvent } from "deep-research/src/middleware/tools-output";
import { ExecuteResearchApproval } from "../components/ExecuteResearchApproval";
import {
  ResearchPlanPreview,
  safeStringify,
} from "../components/PlanExecuteResult";

const planResearchArgsSchema = z.object({
  request: z.string().min(1, "用户的研究需求描述不能为空"),
  context: z.string().optional(),
});

const executeResearchArgsSchema = z.object({
  plan: z.string().describe("plan_research generated JSON plan"),
  context: z.string().optional().describe("调研的额外背景信息（可选）"),
});

export function useToolsCallHooks() {
  const [events, setEvents] = useState<ToolCallEvent[]>([]);

  useHumanInTheLoop({
    name: "execute_research",
    description: `
根据 plan_research 工具生成的调研计划，逐步调用网络工具执行调研。

输入：
- plan: 结构化调研计划（JSON）
- context: 额外上下文信息（可选）

输出：
- 每个步骤的关键信息总结
- 引用来源
- 最终的阶段性研究结论
`.trim(),
    parameters: [
      {
        name: "plan",
        type: "string",
        description: "plan_research 工具生成的 JSON 格式调研计划",
        required: true,
      },
      {
        name: "context",
        type: "string",
        description: "调研的额外背景信息（可选）",
        required: false,
      },
    ],
    render: (data) => {
      const { args, status, respond, result } = data;
      const a = (args ?? {}) as Partial<
        z.infer<typeof executeResearchArgsSchema>
      >;

      if (status === "executing" && respond) {
        return <ExecuteResearchApproval args={a as any} respond={respond} />;
      }

      // execute_research render 内部
      if (status === "complete") {
        return (
          <div className="app-section" style={{ marginTop: 8 }}>
            <div className="app-section-title">
              前端工具执行：execute_research
            </div>
            <p className="app-section-text">状态：已完成</p>

            <div className="app-section-text">输入：</div>
            <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
              <ResearchPlanPreview value={a.plan} />
            </pre>
            {a.context && (
              <>
                <div className="app-section-text" style={{ marginTop: 12 }}>
                  上下文（context）：
                </div>
                <div className="code" style={{ whiteSpace: "pre-wrap" }}>
                  {safeStringify(a.context)}
                </div>
              </>
            )}

            <div className="app-section-text" style={{ marginTop: 12 }}>
              结果：
            </div>
            <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
              <ResearchPlanPreview value={result?.plan} collapsed={false} />
            </pre>
          </div>
        );
      }
      return null;
    },
  });

  useHumanInTheLoop({
    name: "plan_research",
    description: `
制定深度调研计划。

使用场景：
- 用户提出新的研究需求
- 需要将复杂问题分解为可执行步骤
- 需要系统性地规划调研方向

输入：用户的研究需求描述（自然语言）
输出：结构化的调研计划（JSON 格式），包含调研步骤、问题和预期产出

注意：调用此工具后，应根据返回的计划使用 execute_research 工具逐步执行调研。
`.trim(),
    parameters: [
      {
        name: "request",
        type: "string",
        description: "用户的研究需求描述",
        required: true,
      },
      {
        name: "context",
        type: "string",
        description: "研究的额外背景信息（可选）",
        required: false,
      },
    ],
    render: (data) => {
      const { args, status, respond, result } = data;
      const a = (args ?? {}) as Partial<z.infer<typeof planResearchArgsSchema>>;
      console.log("plan_research args:", data);
      // If executing and we have respond function, show approval UI
      if (status === "executing" && respond) {
        return (
          <div
            className="app-section"
            style={{
              marginTop: 8,
              border: "1px solid #e5e7eb",
              padding: 16,
              borderRadius: 8,
            }}
          >
            <div className="app-section-title">计划审批：plan_research</div>

            <div className="app-section-text">Request:</div>
            <pre
              className="code"
              style={{
                whiteSpace: "pre-wrap",
                background: "#f3f4f6",
                padding: 8,
                borderRadius: 4,
              }}
            >
              {safeStringify(a.request)}
            </pre>

            {a.context && (
              <>
                <div className="app-section-text">Context:</div>
                <pre
                  className="code"
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f3f4f6",
                    padding: 8,
                    borderRadius: 4,
                  }}
                >
                  {safeStringify(a.context)}
                </pre>
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => respond("approve")}
                style={{
                  backgroundColor: "#2563eb",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Approve
              </button>
              <button
                onClick={() => respond("reject")}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
            </div>
          </div>
        );
      }

      // Show result after completion
      if (status === "complete") {
        return (
          <div className="app-section" style={{ marginTop: 8 }}>
            <div className="app-section-title">前端工具执行：plan_research</div>
            <p className="app-section-text">状态：已完成</p>
            <div className="app-section-text">结果：</div>
            <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
              {safeStringify(result)}
            </pre>
          </div>
        );
      }

      return null;
    },
  });

  useFrontendTool({
    name: "web_search",
    description: `
使用 Tavily 进行通用网络搜索，获取高质量搜索结果摘要。
适用于：快速了解一个主题、查找事实、获取多来源观点。
`.trim(),
    parameters: [
      {
        name: "query",
        type: "string",
        description: "要查询的搜索关键词或问题",
        required: true,
      },
      {
        name: "searchDepth",
        type: "string",
        description: "搜索深度",
        required: false,
        enum: ["basic", "advanced"],
      },
      {
        name: "timeRange",
        type: "string",
        description: "时间范围",
        required: false,
        enum: ["day", "week", "month", "year"],
      },
    ],

    render: ({ args }: { args: Record<string, unknown> }) => {
      console.log("web_search args:", args);
    
      const { query } = args || {};
      if(!query){
        return null
      }
      return (
        <div className="app-section">
          <div className="app-section-title">网络搜索：{query}</div>
        </div>
      );
    },
  });

  return events;
}
