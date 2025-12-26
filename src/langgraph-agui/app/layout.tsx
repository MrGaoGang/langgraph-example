
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";
import { Sidebar } from "./components/Sidebar";

export const metadata: Metadata = {
  title: "CopilotKit + LangGraph Local Agent Demo",
  description:
    "TypeScript demo: Next.js App Router + CopilotKit + local LangGraph agent (no langgraph-cli).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50">
        <div className="min-h-screen flex">
          <Sidebar />
          <main className="flex-1 p-8 overflow-y-auto h-screen">
            <div className="max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
