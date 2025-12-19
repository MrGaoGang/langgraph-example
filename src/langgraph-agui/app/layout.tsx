import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";

export const metadata: Metadata = {
  title: "CopilotKit + LangGraph Local Agent Demo",
  description: "TypeScript demo: Next.js App Router + CopilotKit + local LangGraph agent (no langgraph-cli).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <CopilotKit runtimeUrl="/api/copilotkit" agent="ts_graph_agent">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
