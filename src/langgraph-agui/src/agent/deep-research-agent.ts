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
  isToolMessageChunk,
} from "@langchain/core/messages";
import { DeepResearchAgent } from "deep-research/src/index";
import { Command } from "@langchain/langgraph";
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

          console.log("tools=========: ", input.tools);
          const serverToolsShow = input.tools.find(
            (tool) => tool.name === "serverToolsShow"
          );

          // 调用 deepsearch Agent
          const { agent, userPrompt } = await deepsearch.getResearchAgent({
            query:
              typeof content === "string" ? content : JSON.stringify(content),
            mode: "DEEP",
            context: "技术方案调研",
          });

          const config = {
            version: "v2" as const,
            configurable: {
              thread_id: input.threadId,
            },
          };

          // Check if we are resuming from an interrupt
          const lastMsg = input.messages?.[input.messages.length - 1];
          let inputStream;

          // Check current state to see if we are interrupted
          const state = await agent.getState(config);
          const isInterrupted =
            state.tasks.length > 0 && state.tasks[0].interrupts.length > 0;
          console.log(
            isInterrupted,
            "<<<isInterrupted ======= state: ",
            lastMsg
          );

          if (isInterrupted && lastMsg?.role === "tool") {
            // Resume with the tool output (which contains the user's decision)
            let decision = lastMsg.content;

            console.log("Resuming with decision:", decision);

            // Use Command to resume
            inputStream = await agent.streamEvents(
              new Command({ resume: { decisions: [{ type: decision }] } }),
              config
            );
          } else {
            // Normal start
            inputStream = await agent.streamEvents(
              { messages: [new HumanMessage({ content: userPrompt })] },
              config
            );
          }

          const messageId = Date.now().toString();

          for await (const event of inputStream) {
            if (
              event.event === "on_chat_model_stream" ||
              event.event === "on_llm_stream"
            ) {
              const chunk = event.data.chunk;
              // console.log('=======event=========chunk: ', event);
              if (chunk.content) {
                observer.next({
                  type: EventType.TEXT_MESSAGE_CHUNK,
                  messageId,
                  delta: chunk.content,
                } as any);
              }

              if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
                // console.log('chunk.tool_call_chunks: ', chunk.tool_call_chunks);
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

          // After stream finishes, check if we are interrupted again (or for the first time)
          const finalState = await agent.getState(config);
          console.log("finalState: ", finalState);
          if (
            finalState.tasks.length > 0 &&
            finalState.tasks[0].interrupts.length > 0
          ) {
            const interrupt = finalState.tasks[0].interrupts[0];
            console.log("Agent interrupted:", interrupt);

            const interruptValue = interrupt.value;

            if (
              interruptValue &&
              interruptValue.action_requests &&
              interruptValue.action_requests.length > 0
            ) {
              const action = interruptValue.action_requests[0];
              // Emit a tool call event so the frontend shows the approval UI
              observer.next({
                type: EventType.TOOL_CALL_CHUNK,
                toolCallId: "interrupt_" + Date.now(),
                toolCallName: action.name,
                parentMessageId: messageId,
                delta: JSON.stringify(action.arguments),
              } as any);
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
