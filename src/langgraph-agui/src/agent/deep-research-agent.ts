import {
  AbstractAgent,
  RunAgentInput,
  EventType,
  BaseEvent,
} from "@ag-ui/client";
import { Observable } from "rxjs";

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { DeepResearchAgent } from "deep-research/src/index";

export class DeepResearchAdapterAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      (async () => {
        try {
          observer.next({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          } as any);

          const deepsearch = new DeepResearchAgent();
          const content =
            input?.messages?.[input.messages.length - 1]?.content ?? "";
          const { agent, userPrompt } = await deepsearch.getResearchAgent({
            query: content,
            mode: 'AUTO',
            context: "技术方案调研",
          });

          const stream = await agent.streamEvents(
            { messages: [new HumanMessage({ content: userPrompt })] },
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
