import {
  AbstractAgent,
  RunAgentInput,
  EventType,
  BaseEvent,
} from "@ag-ui/client";
import { Observable } from "rxjs";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

type AnyTool = Record<string, any>;

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean | null>;
};

type CopilotKitParam = {
  name?: string;
  description?: string;
  type?: string;
  required?: boolean;
  enum?: any[];
  attributes?: CopilotKitParam[];
};

function transformSchema(parameters: any): JsonSchema {
  if (!parameters) {
    return { type: "object", properties: {} };
  }

  if (Array.isArray(parameters)) {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const param of parameters) {
      const name = String(param?.name ?? "").trim();
      if (!name) continue;

      let fieldSchema: JsonSchema = {};
      const type = String(param?.type ?? "").toLowerCase();

      if (Array.isArray(param?.enum) && param.enum.length > 0) {
        fieldSchema.enum = param.enum as any;
        if (param.enum.every((v: any) => typeof v === "string")) {
          fieldSchema.type = "string";
        } else if (param.enum.every((v: any) => typeof v === "number")) {
          fieldSchema.type = "number";
        }
      } else if (type === "string") {
        fieldSchema.type = "string";
      } else if (type === "number" || type === "integer") {
        fieldSchema.type = "number";
      } else if (type === "boolean") {
        fieldSchema.type = "boolean";
      } else if (type === "object" && Array.isArray(param?.attributes)) {
        fieldSchema = transformSchema(param.attributes);
      } else if (type.endsWith("[]")) {
        fieldSchema.type = "array";
        const itemType = type.slice(0, -2);
        if (itemType === "string") {
          fieldSchema.items = { type: "string" };
        } else if (itemType === "number" || itemType === "integer") {
          fieldSchema.items = { type: "number" };
        } else if (itemType === "boolean") {
          fieldSchema.items = { type: "boolean" };
        } else {
          fieldSchema.items = {};
        }
      }

      if (param?.description) {
        fieldSchema.description = param.description;
      }

      properties[name] = fieldSchema;
      if (param?.required) {
        required.push(name);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  return parameters;
}

function aguiToolToDynamicStructuredTool(tool: AnyTool): DynamicStructuredTool {
  const name = String(tool?.name ?? "").trim() || "unnamed_tool";
  const description = String(tool?.description ?? "");
  const schema = transformSchema(tool?.parameters);

  return new DynamicStructuredTool({
    name,
    description,
    // 老版本只支持 object schema
    schema: schema as any,
    func: async () => "",
  });
}

function coerceTools(incoming: unknown): AnyTool[] {
  const tools = (Array.isArray(incoming) ? incoming : []) as AnyTool[];

  return tools.map((tool) => {
    if (
      tool &&
      typeof tool?.name === "string" &&
      typeof tool?.invoke === "function"
    ) {
      return tool;
    }

    return aguiToolToDynamicStructuredTool(tool);
  });
}

type AnyIncomingMessage = Record<string, any>;

function safeJsonParse(raw: unknown): any {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeToolCalls(toolCalls: unknown): any[] | undefined {
  if (!toolCalls) return undefined;
  const calls = Array.isArray(toolCalls) ? toolCalls : [];

  return calls
    .map((tc: any) => {
      if (tc?.function?.name) {
        return {
          id: tc.id,
          name: tc.function.name,
          args:
            typeof tc.function.arguments === "string"
              ? safeJsonParse(tc.function.arguments)
              : tc.function.arguments,
        };
      }
      if (tc?.name) {
        return {
          id: tc.id,
          name: tc.name,
          args: tc.args ?? {},
        };
      }
      return undefined;
    })
    .filter(Boolean);
}

function coerceMessages(incoming: unknown): BaseMessage[] {
  const messages = (
    Array.isArray(incoming) ? incoming : []
  ) as AnyIncomingMessage[];

  return messages.map((m) => {
    if (m && typeof m?._getType === "function") {
      return m as BaseMessage;
    }

    const role = String(m?.role ?? "user");
    const content = (m?.content ?? "") as any;

    if (role === "system") {
      return new SystemMessage({ content });
    }

    if (role === "assistant") {
      const toolCalls = normalizeToolCalls(m?.toolCalls ?? m?.tool_calls);
      return new AIMessage({
        content,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      } as any);
    }

    if (role === "tool") {
      const toolCallId = String(m?.toolCallId ?? m?.tool_call_id ?? "");
      return new ToolMessage({
        content:
          typeof content === "string" ? content : JSON.stringify(content),
        tool_call_id: toolCallId,
      } as any);
    }

    return new HumanMessage({ content });
  });
}

export class ReactLangGraphAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      (async () => {
        try {
          observer.next({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          } as any);

          const baseURL = process.env.OPENAI_BASE_URL;
          let modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
          // OpenRouter 的模型名通常需要带 provider 前缀，例如 `openai/gpt-4o`。
          // 如果你只写了 `gpt-4o`，OpenRouter 可能会直接返回 400。
          if (baseURL?.includes("openrouter.ai") && !modelName.includes("/")) {
            modelName = `openai/${modelName}`;
          }
          const model = new ChatOpenAI({
            modelName: modelName,
            temperature: 0.7,
            apiKey: process.env.OPENROUTER_API_KEY,
            configuration: {
              baseURL: "https://openrouter.ai/api/v1",
            },
          });


          const tools = coerceTools(input.tools);
          console.log("tools", tools);
          const messages = coerceMessages(input.messages);
          const agent = createReactAgent({
            llm: model,
            tools: tools,
          });
          const stream = await agent.streamEvents(
            { messages },
            {
              version: "v2",
              configurable: {
                thread_id: input.threadId,
              },
            }
          );

          const messageId = Date.now().toString();

          for await (const event of stream) {
            if (
              event.event === "on_chat_model_stream" ||
              event.event === "on_llm_stream"
            ) {
              const chunk = event.data.chunk;
              if (chunk.content) {
                observer.next({
                  type: EventType.TEXT_MESSAGE_CHUNK,
                  messageId,
                  delta: chunk.content,
                } as any);
              }

              if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
                for (const toolCallChunk of chunk.tool_call_chunks) {
                  observer.next({
                    type: EventType.TOOL_CALL_CHUNK,
                    toolCallId: toolCallChunk.id,
                    toolCallName: toolCallChunk.name,
                    parentMessageId: messageId,
                    delta: toolCallChunk.args,
                  } as any);
                }
              }
            }
          }

          observer.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          } as any);

          observer.complete();
        } catch (error: any) {
          observer.next({
            type: EventType.RUN_ERROR,
            message: error.message,
          } as any);

          observer.error(error);
        }
      })();
    });
  }
}
