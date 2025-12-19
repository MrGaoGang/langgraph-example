import {
  AbstractAgent,
  RunAgentInput,
  EventType,
  BaseEvent,
} from "@ag-ui/client";
import { Observable } from "rxjs";

import { OpenAI } from "openai";
// import 'dotenv/config'

export class CustomAgent extends AbstractAgent {
  private openai?: OpenAI;

  constructor(openai?: OpenAI) {
    super();
    this.openai = openai;
  }

  private getOpenAIClient(): OpenAI {
    if (this.openai) return this.openai;

    this.openai = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });

    return this.openai;
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      observer.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      } as any);

      const openai = this.getOpenAIClient();

      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        stream: true,
        // 将工具转换为 OpenAI 工具格式
        tools: input.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        // 将消息转换为 OpenAI 消息格式
        messages: input.messages.map((message) => ({
          role: message.role as any,
          content: message.content ?? "",
          ...(message.role === "assistant" && message.toolCalls
            ? {
                tool_calls: message.toolCalls,
              }
            : {}),
          ...(message.role === "tool"
            ? { tool_call_id: message.toolCallId }
            : {}),
        })),
      })
        .then(async (response) => {
          const messageId = Date.now().toString();

          for await (const chunk of response) {
            if (chunk.choices[0].delta.content) {
              observer.next({
                type: EventType.TEXT_MESSAGE_CHUNK,
                messageId,
                delta: chunk.choices[0].delta.content,
              } as any);
            } else if (chunk.choices[0].delta.tool_calls) {
              let toolCall = chunk.choices[0].delta.tool_calls[0];

              observer.next({
                type: EventType.TOOL_CALL_CHUNK,
                toolCallId: toolCall.id,
                toolCallName: toolCall.function?.name,
                parentMessageId: messageId,
                delta: toolCall.function?.arguments,
              } as any);
            }
          }

          observer.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          } as any);

          observer.complete();
        })
        .catch((error) => {
          observer.next({
            type: EventType.RUN_ERROR,
            message: error.message,
          } as any);

          observer.error(error);
        });
    });
  }
}
