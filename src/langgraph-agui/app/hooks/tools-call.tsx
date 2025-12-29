import { useFrontendTool } from "@copilotkit/react-core";
import { useState } from "react";
import z from "zod";

import type { ToolCallEvent } from "deep-research/src/middleware/tools-output";

const toolCallEventArgsSchema = z.object({
  callId: z.string().min(1).optional(),
  name: z.string().min(1),
  args: z.any().optional(),
  status: z.enum(["start", "end", "error"]).optional(),
  error: z.any().optional(),
  timestamp: z.number().int().optional(),
});

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatEventStatus(status?: string) {
  if (status === "start") return "start（开始）";
  if (status === "end") return "end（结束）";
  if (status === "error") return "error（错误）";
  return "—";
}

const planResearchArgsSchema = z.object({
  request: z.string().min(1, "用户的研究需求描述不能为空"),
  context: z.string().optional(),
});

const webSearchArgsSchema = z.object({
  query: z.string().min(1, "搜索 query 不能为空"),
  searchDepth: z.enum(["basic", "advanced"]).optional(),
  timeRange: z.enum(["day", "week", "month", "year"]).optional(),
});

export function useToolsCallHooks() {
  const [events, setEvents] = useState<ToolCallEvent[]>([]);

  useFrontendTool({
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
    // handler: async (rawArgs: unknown) => {
    //   const parsed = planResearchArgsSchema.safeParse(
    //     rawArgs as Record<string, unknown>
    //   );
    //   if (!parsed.success) {
    //     throw new Error("Invalid arguments for plan_research");
    //   }

    //   const res = await fetch("/api/deep-research/plan_research", {
    //     method: "POST",
    //     headers: { "content-type": "application/json" },
    //     body: JSON.stringify(parsed.data),
    //   });

    //   if (!res.ok) {
    //     const text = await res.text().catch(() => "");
    //     throw new Error(
    //       `plan_research request failed: HTTP ${res.status} ${text}`.trim()
    //     );
    //   }

    //   const data = (await res.json().catch(() => null)) as any;

    //   if (typeof data === "string") return { content: data };
    //   if (data && typeof data.content === "string") return { content: data.content };
    //   if (data && typeof data.plan === "string") return { content: data.plan };

    //   return data ?? { content: "" };
    // },
    render: ({ args, status, result }) => {
      const a = (args ?? {}) as Partial<z.infer<typeof planResearchArgsSchema>>;
      const r = (result ?? {}) as { content?: unknown };

      return (
        <div className="app-section" style={{ marginTop: 8 }}>
          <div className="app-section-title">前端工具执行：plan_research</div>

          <p className="app-section-text">当前状态：{status}</p>

          <div className="app-section-text">request：</div>
          <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
            {safeStringify(a.request)}
          </pre>

          {a.context && (
            <>
              <div className="app-section-text">context：</div>
              <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
                {safeStringify(a.context)}
              </pre>
            </>
          )}

          {status === "complete" && (
            <>
              <div className="app-section-text">输出（content）：</div>
              <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
                {safeStringify(r.content)}
              </pre>
            </>
          )}
        </div>
      );
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
        description: "搜索深度（basic / advanced）",
        required: false,
        enum: ["basic", "advanced"],
      },
      {
        name: "timeRange",
        type: "string",
        description: "时间范围（day/week/month/year）",
        required: false,
        enum: ["day", "week", "month", "year"],
      },
    ],
    // handler: async (rawArgs: unknown) => {
    //   const parsed = webSearchArgsSchema.safeParse(
    //     rawArgs as Record<string, unknown>
    //   );
    //   if (!parsed.success) {
    //     throw new Error("Invalid arguments for web_search");
    //   }

    //   const res = await fetch("/api/deep-research/web_search", {
    //     method: "POST",
    //     headers: { "content-type": "application/json" },
    //     body: JSON.stringify(parsed.data),
    //   });

    //   if (!res.ok) {
    //     const text = await res.text().catch(() => "");
    //     throw new Error(
    //       `web_search request failed: HTTP ${res.status} ${text}`.trim()
    //     );
    //   }

    //   const data = (await res.json().catch(() => null)) as any;

    //   if (typeof data === "string") return { content: data };
    //   if (data && typeof data.content === "string") return { content: data.content };
    //   if (data && typeof data.result === "string") return { content: data.result };

    //   return data ?? { content: "" };
    // },
    render: ({ args, status, result }) => {
      const a = (args ?? {}) as Partial<z.infer<typeof webSearchArgsSchema>>;
      const r = (result ?? {}) as { content?: unknown };

      return (
        <div className="app-section" style={{ marginTop: 8 }}>
          <div className="app-section-title">前端工具执行：web_search</div>

          <p className="app-section-text">当前状态：{status}</p>

          <div className="app-section-text">query：</div>
          <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
            {safeStringify(a.query)}
          </pre>

          {(a.searchDepth || a.timeRange) && (
            <>
              <div className="app-section-text">options：</div>
              <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
                {safeStringify({
                  searchDepth: a.searchDepth,
                  timeRange: a.timeRange,
                })}
              </pre>
            </>
          )}

          {status === "complete" && (
            <>
              <div className="app-section-text">输出（content）：</div>
              <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
                {safeStringify(r.content)}
              </pre>
            </>
          )}
        </div>
      );
    },
  });

 

  // useFrontendTool({
  //   name: "serverToolsShow",
  //   description:
  //     "Report a ToolCallEvent (start/end/error) to the Next.js UI for rendering.",
  //   parameters: [
  //     { name: "callId", type: "string", description: "Tool call id." },
  //     { name: "name", type: "string", description: "Tool name." },
  //     { name: "args", type: "object", description: "Tool call args.", optional: true },
  //     {
  //       name: "status",
  //       type: "string",
  //       description: "Tool call status.",
  //       enum: ["start", "end", "error"],
  //     },
  //     { name: "error", type: "object", description: "Error payload." },
  //     { name: "timestamp", type: "number", description: "Timestamp (ms).", optional: true },
  //   ],
  //   // handler: async (rawArgs: unknown) => {
  //   //   const parsed = toolCallEventArgsSchema.safeParse(rawArgs as Record<string, unknown>);
  //   //   if (!parsed.success) {
  //   //     throw new Error("Invalid arguments for tool_call_event");
  //   //   }

  //   //   const event = parsed.data as ToolCallEvent;

  //   //   setEvents((prev) => {
  //   //     const next = [...prev, event];
  //   //     return next.length > 50 ? next.slice(next.length - 50) : next;
  //   //   });

  //   //   return event;
  //   // },
  //   render: ({ args, status, result }) => {
  //     console.log('args: ', args, '========status: ', status, '===========', result);
  //     const event = (args ?? {}) as Partial<ToolCallEvent>;
  //     const doneEvent = (result ?? {}) as Partial<ToolCallEvent>;
  //     const eventTime =
  //       typeof event.timestamp === "number"
  //         ? new Date(event.timestamp).toLocaleString()
  //         : "—";

  //     return (
  //       <div className="app-section" style={{ marginTop: 8 }}>
  //         <div className="app-section-title">前端工具执行：tool_call_event</div>

  //         <p className="app-section-text">渲染状态：{status}</p>
  //         <p className="app-section-text">事件状态：{formatEventStatus(event.status)}</p>

  //         <p className="app-section-text">工具名：{event.name ?? "—"}</p>
  //         <p className="app-section-text">callId：{event.callId ?? "—"}</p>
  //         <p className="app-section-text">时间：{eventTime}</p>

  //         <div className="app-section-text">参数：</div>
  //         <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
  //           {safeStringify(event.args)}
  //         </pre>

  //         {event.status === "error" && (
  //           <div className="app-section-text" style={{ color: "#b91c1c" }}>
  //             错误：
  //             <pre className="code" style={{ whiteSpace: "pre-wrap" }}>
  //               {safeStringify(event.error)}
  //             </pre>
  //           </div>
  //         )}

  //         {status === "complete" && (
  //           <p className="app-section-text">
  //             最终事件：{formatEventStatus(doneEvent.status)}
  //           </p>
  //         )}
  //       </div>
  //     );
  //   },
  // });

  return events;
}
