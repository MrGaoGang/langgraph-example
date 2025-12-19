import { useFrontendTool } from "@copilotkit/react-core";
import z from "zod";

export function useColorChange() {
  useFrontendTool({
    name: "changeBackgroundColor",
    description: "Change the background color of the page.",
    parameters: [
      {
        name: "color",
        type: "string",
        description: "The new background color (e.g., 'red', '#00ff00').",
        required: true,
      },
    ],
    handler: async (rawArgs: unknown) => {
      const parsed = z
        .object({
          color: z.string().min(1, "颜色不能为空"),
        })
        .safeParse(rawArgs as Record<string, unknown>);
      if (!parsed.success) {
        throw new Error("Invalid arguments for changeBackgroundColor");
      }
      const { color } = parsed.data;
      document.body.style.backgroundColor = color;
      // Web -》 API -> AI -> tools -> response -> get ->setState
      // Web Tools ->AI -> setState
      return { color };
    },
  });
}
