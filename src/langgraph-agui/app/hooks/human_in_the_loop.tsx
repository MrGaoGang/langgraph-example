import { useCopilotAction, useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core";

import StepsFeedback from "../componentts/StepsFeedback";

export function useHumanInTheLoopHooks() {
  useHumanInTheLoop({
    name: "generate_task_steps",
    description: "Generates a list of steps for the user to perform. response status should be 'enabled' or 'disabled' or 'executing'",
    parameters: [
      {
        name: "steps",
        type: "object[]",
        attributes: [
          {
            name: "description",
            type: "string",
          },
          {
            name: "status",
            type: "string",
            enum: ["enabled", "disabled", "executing"],
          },
        ],
      },
    ],
    render: ({ args, respond, status }) => {
      console.log("args=====", args, "status=====", status, "respond=====", respond);
      return <StepsFeedback args={args} respond={respond} status={status} />;
    },
  });
}
