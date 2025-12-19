import { useFrontendTool } from "@copilotkit/react-core";
import { useState } from "react";
import z from "zod";

const updateCounterArgsSchema = z.object({
  value: z.number().int().min(0, "值不能小于 0").max(100, "值不能大于 100"),
});
export function useCountChange() {
  const [counter, setCounter] = useState(0);

  useFrontendTool({
    name: "update_counter",
    description:
      "Update a local counter in the Next.js UI to a value between 0 and 100.",
    parameters: [
      {
        name: "value",
        type: "number",
        description: "The new value for the counter (0-100).",
        required: true,
      },
    ],
    handler: async (rawArgs: unknown) => {
      console.log("rawArgs=====", rawArgs);
      const parsed = updateCounterArgsSchema.safeParse(
        rawArgs as Record<string, unknown>
      );
      if (!parsed.success) {
        throw new Error("Invalid arguments for update_counter");
      }
      const { value } = parsed.data;
      setCounter(value);
      return { value };
    },
    render: ({ args, status, result }) => {
      const value = (args as { value?: number })?.value;
      return (
        <div className="app-section" style={{ marginTop: 8 }}>
          <div className="app-section-title">前端工具执行：update_counter</div>
          <p className="app-section-text">当前状态：{status}</p>
          <p className="app-section-text">目标值：{value ?? "—"}</p>
          {status === "complete" && result && (
            <p className="app-section-text">
              最终计数器值：{(result as { value?: number }).value ?? "—"}
            </p>
          )}
        </div>
      );
    },
  });
  return counter;
}
