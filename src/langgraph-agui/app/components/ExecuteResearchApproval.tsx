import { useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core";
import { useState } from "react";
import z from "zod";
import { safeStringify } from "./PlanExecuteResult";



const executeResearchArgsSchema = z.object({
  plan: z.string().describe("plan_research generated JSON plan"),
  context: z.string().optional().describe("调研的额外背景信息（可选）"),
});

interface ResearchStep {
  id: number;
  title: string;
  description: string;
  questions: string[];
  expectedOutput: string;
}

interface ResearchPlan {
  goal: string;
  steps: ResearchStep[];
}

export const ExecuteResearchApproval = ({
  args,
  respond,
}: {
  args: z.infer<typeof executeResearchArgsSchema>;
  respond: (value: any) => void;
}) => {
  const [rawPlan, setRawPlan] = useState(args.plan);
  const [parsedPlan, setParsedPlan] = useState<ResearchPlan | null>(null);
  const [isRawMode, setIsRawMode] = useState(false);
  const [disabledStepIndices, setDisabledStepIndices] = useState<Set<number>>(
    new Set()
  );

  // Initialize
  useState(() => {
    try {
      const parsed = JSON.parse(args.plan);
      if (parsed && Array.isArray(parsed.steps)) {
        setParsedPlan(parsed);
      } else {
        setIsRawMode(true);
      }
    } catch {
      setIsRawMode(true);
    }
  });

  const handleStepChange = (
    index: number,
    field: keyof ResearchStep,
    value: any
  ) => {
    if (!parsedPlan) return;
    const newSteps = [...parsedPlan.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setParsedPlan({ ...parsedPlan, steps: newSteps });
  };

  const handleQuestionsChange = (index: number, value: string) => {
    if (!parsedPlan) return;
    const questions = value.split("\n").filter((q) => q.trim().length > 0);
    handleStepChange(index, "questions", questions);
  };

  const toggleStep = (index: number) => {
    const newDisabled = new Set(disabledStepIndices);
    if (newDisabled.has(index)) {
      newDisabled.delete(index);
    } else {
      newDisabled.add(index);
    }
    setDisabledStepIndices(newDisabled);
  };

  const handleConfirm = () => {
    let finalPlanStr = rawPlan;
    if (!isRawMode && parsedPlan) {
      const finalSteps = parsedPlan.steps.filter(
        (_, index) => !disabledStepIndices.has(index)
      );
      finalPlanStr = JSON.stringify(
        { ...parsedPlan, steps: finalSteps },
        null,
        2
      );
    }
    respond({ ...args, plan: finalPlanStr });
  };

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
      <div
        className="app-section-title"
        style={{ display: "flex", justifyContent: "space-between" }}
      >
        <span>计划确认：execute_research</span>
        <button
          onClick={() => setIsRawMode(!isRawMode)}
          style={{
            fontSize: 12,
            color: "#6b7280",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {isRawMode ? "切换到结构化视图" : "切换到源码视图"}
        </button>
      </div>

      {isRawMode || !parsedPlan ? (
        <>
          <div className="app-section-text">调研计划 (JSON):</div>
          <textarea
            value={rawPlan}
            onChange={(e) => {
              setRawPlan(e.target.value);
              // Try to sync back to parsed plan if valid
              try {
                const parsed = JSON.parse(e.target.value);
                if (parsed && Array.isArray(parsed.steps)) {
                  setParsedPlan(parsed);
                }
              } catch {}
            }}
            style={{
              width: "100%",
              minHeight: "300px",
              padding: 8,
              borderRadius: 4,
              border: "1px solid #d1d5db",
              fontFamily: "monospace",
              whiteSpace: "pre",
              marginTop: 8,
              marginBottom: 16,
            }}
          />
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontWeight: 500,
                marginBottom: 4,
                fontSize: 14,
              }}
            >
              整体研究目标
            </label>
            <textarea
              value={parsedPlan.goal}
              onChange={(e) =>
                setParsedPlan({ ...parsedPlan, goal: e.target.value })
              }
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 4,
                border: "1px solid #d1d5db",
                minHeight: 60,
              }}
            />
          </div>

          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
            研究步骤 ({parsedPlan.steps.length - disabledStepIndices.size} /{" "}
            {parsedPlan.steps.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {parsedPlan.steps.map((step, index) => {
              const isDisabled = disabledStepIndices.has(index);
              return (
                <div
                  key={index}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    backgroundColor: isDisabled ? "#f9fafb" : "white",
                    opacity: isDisabled ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!isDisabled}
                      onChange={() => toggleStep(index)}
                      style={{ marginRight: 8, width: 16, height: 16 }}
                    />
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) =>
                        handleStepChange(index, "title", e.target.value)
                      }
                      disabled={isDisabled}
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        padding: "4px 8px",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                      }}
                      placeholder="步骤标题"
                    />
                  </div>

                  {!isDisabled && (
                    <div
                      style={{
                        marginLeft: 24,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          描述
                        </label>
                        <textarea
                          value={step.description}
                          onChange={(e) =>
                            handleStepChange(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                            minHeight: 40,
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          子问题 (每行一个)
                        </label>
                        <textarea
                          value={step.questions.join("\n")}
                          onChange={(e) =>
                            handleQuestionsChange(index, e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                            minHeight: 60,
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          预期产出
                        </label>
                        <input
                          type="text"
                          value={step.expectedOutput}
                          onChange={(e) =>
                            handleStepChange(
                              index,
                              "expectedOutput",
                              e.target.value
                            )
                          }
                          style={{
                            width: "100%",
                            padding: 6,
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            fontSize: 13,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {args.context && (
        <>
          <div className="app-section-text" style={{ marginTop: 16 }}>
            Context:
          </div>
          <pre
            className="code"
            style={{
              whiteSpace: "pre-wrap",
              background: "#f3f4f6",
              padding: 8,
              borderRadius: 4,
              maxHeight: 100,
              overflowY: "auto",
            }}
          >
            {safeStringify(args.context)}
          </pre>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={handleConfirm}
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            padding: "8px 16px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
          }}
        >
          确认并执行
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
          取消
        </button>
      </div>
    </div>
  );
};
