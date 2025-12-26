"use client";

export function FrontendCounterSection({ counter }: { counter: number }) {
  return (
    <div className="app-section">
      <div className="app-section-title">前端计数器（useFrontendTool）</div>
      <p className="app-section-text">
        当前计数器值：
        <span style={{ color: "red", fontWeight: "bold", fontSize: 24 }}>
          {counter}
        </span>
      </p>
      <p className="app-section-text">
        在对话中尝试输入：<span className="code">把计数器改成 5</span>
        ，让 Agent 调用工具 <span className="code">update_counter</span>{" "}
        来更新这里的值。
      </p>
    </div>
  );
}