'use client';
import { CopilotKit } from "@copilotkit/react-core";
import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <CopilotKit runtimeUrl="/api/copilotkit" agent="ts_graph_agent">
        {children}
      </CopilotKit>
    </div>
  );
}
