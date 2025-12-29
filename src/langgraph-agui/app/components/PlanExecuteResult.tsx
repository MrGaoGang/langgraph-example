import { useState } from "react";
import { z } from "zod";

export interface ResearchStep {
  id: number;
  title: string;
  description: string;
  questions: string[];
  expectedOutput: string;
}

export interface ResearchPlan {
  goal: string;
  steps: ResearchStep[];
}

export function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
const researchPlanSchema = z.object({
  goal: z.string(),
  steps: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      title: z.string().default(""),
      description: z.string().default(""),
      questions: z.array(z.string()).default([]),
      expectedOutput: z.string().default(""),
    })
  ),
});

function tryGetResearchPlan(value: unknown): ResearchPlan | null {
  try {
    const maybeObj = typeof value === "string" ? JSON.parse(value) : value;
    const parsed = researchPlanSchema.safeParse(maybeObj);
    if (!parsed.success) return null;

    return {
      goal: parsed.data.goal,
      steps: parsed.data.steps.map((step) => ({
        id: typeof step.id === "string" ? Number(step.id) : step.id,
        title: step.title,
        description: step.description,
        questions: step.questions,
        expectedOutput: step.expectedOutput,
      })),
    };
  } catch {
    return null;
  }
}

export function ResearchPlanPreview({
  value,
  collapsed = true,
}: {
  value: unknown;
  collapsed?: boolean;
}) {
  const plan = tryGetResearchPlan(value);
  const [isStepsCollapsed, setIsStepsCollapsed] = useState(collapsed);
  console.log(plan, "======plan=====", value);
  if (!plan) {
    return (
      <div
        className="code"
        style={{
          whiteSpace: "pre-wrap",
          background: "#f3f4f6",
          padding: 8,
          borderRadius: 4,
        }}
      >
        {safeStringify(value)}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#f3f4f6",
        padding: 12,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>整体研究目标</div>
        <div style={{ whiteSpace: "pre-wrap" }}>{plan.goal}</div>
      </div>

      <div>
        <div
          style={{
            fontWeight: 600,
            marginBottom: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onClick={() => setIsStepsCollapsed(!isStepsCollapsed)}
        >
          <span>步骤</span>
          <span
            style={{
              fontSize: 12,
              color: "#6b7280",
              fontWeight: 400,
              background: "#e5e7eb",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {isStepsCollapsed ? "展开" : "折叠"}
          </span>
        </div>
        {!isStepsCollapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {plan.steps.map((step, index) => (
              <div
                key={`${step.id}-${index}`}
                style={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {step.id}. {step.title}
                </div>

                {step.description && (
                  <div style={{ whiteSpace: "pre-wrap", color: "#374151" }}>
                    {step.description}
                  </div>
                )}

                {step.questions?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 4,
                      }}
                    >
                      子问题
                    </div>
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                      {step.questions.map((q, qi) => (
                        <li key={qi} style={{ whiteSpace: "pre-wrap" }}>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.expectedOutput && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 4,
                      }}
                    >
                      预期产出
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {step.expectedOutput}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
