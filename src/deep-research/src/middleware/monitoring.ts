import { createMiddleware } from "langchain";

const Logger = {
  debug: (...args: any[]) => {
    console.debug(...args);
  },
};

export const toolMonitoringMiddleware = createMiddleware({
  name: "ToolMonitoringMiddleware",
  wrapToolCall: (request, handler) => {
    Logger.debug(`Executing tool: ${request.toolCall.name}`);
    Logger.debug(`Arguments: ${JSON.stringify(request.toolCall.args)}`);

    try {
      const result = handler(request);
      Logger.debug("Tool completed successfully");
      return result;
    } catch (e) {
      Logger.debug(`Tool failed: ${e}`);
      throw e;
    }
  },
});