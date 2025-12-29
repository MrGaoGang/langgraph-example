import {
  AbstractAgent,
  RunAgentInput,
  EventType,
  BaseEvent,
} from "@ag-ui/client";
import { Observable, Subscriber } from "rxjs";

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

/**
 * 当图处于这些工具调用阶段时，隐藏 LLM 文本输出（仅影响 TEXT_MESSAGE_CHUNK）。
 *
 * 说明：用模块级常量可以避免方法被非绑定调用时 `this` 丢失导致的运行时错误。
 */
const DEFAULT_IGNORED_TOOLS = ["plan_research"] as const;

/**
 * 运行一次 DeepResearch 的过程中会用到的共享上下文。
 *
 * - 用途：把初始化阶段、执行阶段、流式输出阶段、收尾阶段需要共享的数据集中管理。
 * - 生命周期：`run()` 内部单次执行创建，用完即丢弃；不会跨 run 复用。
 * - 注意：其中 `agent/config/inputStream` 等字段会在不同阶段逐步补齐。
 */
interface DeepResearchContext {
  /**
   * 来自 AG-UI 的输入对象，包含 thread/run 标识与历史消息等。
   */
  input: RunAgentInput;

  /**
   * RxJS 订阅者：用于向前端持续推送事件（文本 chunk、tool call chunk、结束/错误等）。
   */
  observer: Subscriber<BaseEvent>;

  /**
   * deep-research 封装出来的 LangGraph Agent 实例。
   *
   * - 用于调用 `getState()` 读取图状态
   * - 用于调用 `streamEvents()` 以事件流形式执行/续跑
   */
  agent?: any;

  /**
   * LangGraph 运行配置，通常包含 thread_id 等可配置项。
   *
   * 这里保持 `any` 是因为不同版本/实现的 config 结构可能不同。
   */
  config?: any;

  /**
   * deep-research 组装后的最终用户提示词（可能包含系统提示/任务模板等）。
   *
   * 注意：这不是 UI 原始输入，而是 deep-research 返回的“可执行 prompt”。
   */
  userPrompt?: string;

  /**
   * `agent.streamEvents()` 返回的异步迭代器（AsyncIterable）。
   * 用于在 `handleStreamEvents()` 中 for-await 逐条消费事件。
   */
  inputStream?: any;

  /**
   * 是否忽略本轮执行中的“工具相关消息”的文本输出（仅影响 TEXT_MESSAGE_CHUNK）。
   *
   * 用途：某些工具（例如 plan 阶段）可能不希望把中间推理过程直接展示给用户。
   */
  ignoreToolsMessage?: boolean;

  /**
   * 本轮 run 用于聚合流式文本的 messageId。
   *
   * 前端通常会用这个 ID 将多个 chunk 拼接为同一条消息。
   */
  messageId?: string;
}

export class DeepResearchAdapterAgent extends AbstractAgent {
  /**
   * 需要被“隐藏”的工具名列表：当 agent 正在调用这些工具时，
   * 不将 LLM 输出的文本 chunk 透传到前端（避免暴露规划/中间过程）。
   */
  private readonly ignoredTools: readonly string[] = DEFAULT_IGNORED_TOOLS;

  /**
   * AG-UI Agent 统一入口：把 deep-research/LangGraph 的执行流适配为 AG-UI 事件流。
   *
   * 关键行为：
   * - RUN_STARTED：立刻发出，告知前端本次 run 已开始
   * - 流式事件：把 LangGraph 的 `streamEvents` 转成 TEXT_MESSAGE_CHUNK / TOOL_CALL_CHUNK
   * - RUN_FINISHED：正常结束时发出
   * - RUN_ERROR：异常时发出
   *
   * 说明：这里用 Observable 包一层，是为了让前端能够订阅实时增量输出。
   */
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((observer) => {
      // 单次 run 的共享上下文对象
      const context: DeepResearchContext = {
        input,
        observer,
      };

      // 注意：Observable 的执行体不能直接标记为 async，因此手动起一个 async IIFE
      (async () => {
        try {
          await this.initializeAgent(context);
          await this.prepareExecution(context);
          await this.handleStreamEvents(context);
          await this.handlePostExecution(context);
        } catch (error: any) {
          this.handleError(context, error);
        }
      })();
    });
  }

  /**
   * 初始化 deep-research Agent 并写入上下文。
   *
   * 做的事情：
   * - 向前端发送 RUN_STARTED
   * - 从输入消息中取最后一条作为 query
   * - 调用 deep-research 封装的 `getResearchAgent()` 获取可执行的 agent + 组装后的 userPrompt
   * - 构建 LangGraph config（thread_id 用于把状态绑定到会话线程）
   */
  private async initializeAgent(context: DeepResearchContext) {
    const { input, observer } = context;

    observer.next({
      type: EventType.RUN_STARTED,
      threadId: input.threadId,
      runId: input.runId,
    } as any);

    const deepsearch = new DeepResearchAgent();

    // 取输入 messages 的最后一条作为本轮 query（通常是用户最后一句）
    const content = input?.messages?.[input.messages.length - 1]?.content ?? "";

    // 调用 deep-research：返回 LangGraph agent 与已拼好的最终 prompt
    const { agent, userPrompt } = await deepsearch.getResearchAgent({
      query: typeof content === "string" ? content : JSON.stringify(content),
      mode: "DEEP",
      context: "技术方案调研",
    });

    // LangGraph 运行配置：thread_id 用于把状态（checkpoints）与 thread 关联
    const config = {
      version: "v2" as const,
      configurable: {
        thread_id: input.threadId,
      },
    };

    context.agent = agent;
    context.userPrompt = userPrompt;
    context.config = config;
  }

  /**
   * 准备执行（或从 interrupt 续跑）。
   *
   * 逻辑：
   * - 先读取当前图状态 `agent.getState(config)`
   * - 如果存在 interrupts 且最后一条 UI 消息是 tool，则认为前端已给出“决策”，走 resume
   * - 否则按正常路径把 `userPrompt` 作为 HumanMessage 启动执行
   */
  private async prepareExecution(context: DeepResearchContext) {
    const { input, agent, config } = context;

    // UI 输入的最后一条消息，用于判断是否携带了“工具决策”(role === tool)
    const lastMsg = input.messages?.[input.messages.length - 1];

    // 当前 LangGraph 状态，用于判断是否处于 interrupt 中
    const state = await agent.getState(config);
    console.log("DEBUG: state: ", state);

    // 根据当前状态判断是否需要隐藏工具相关输出
    await this.determineIgnoreToolsMessage(context);

    const isInterrupted =
      state.tasks.length > 0 && state.tasks[0].interrupts.length > 0;
    console.log(isInterrupted, "<<<isInterrupted ======= state: ", lastMsg);

    if (isInterrupted && lastMsg?.role === "tool") {
      // 从 interrupt 续跑：lastMsg.content 约定为前端回传的决策类型
      const decision = lastMsg.content;
      console.log("Resuming with decision:", decision);

      // 使用 Command.resume 把决策喂回图中继续执行
      context.inputStream = await agent.streamEvents(
        new Command({ resume: { decisions: [{ type: decision }] } }),
        config
      );
    } else {
      // 正常启动：将 deep-research 返回的最终 prompt 作为用户消息输入
      context.inputStream = await agent.streamEvents(
        { messages: [new HumanMessage({ content: context.userPrompt })] },
        config
      );
    }
  }

  /**
   * 根据“当前图状态的最后一条消息”判断是否要隐藏工具消息。
   *
   * 背景：在某些工具调用（比如规划 plan）期间，LLM 可能会输出中间文本。
   * 这些文本对用户不友好或不应展示，因此当检测到最后一条 state message 含 tool_calls，
   * 且 tool name 命中 `ignoredTools` 时，置 `context.ignoreToolsMessage = true`。
   */
  private async determineIgnoreToolsMessage(context: DeepResearchContext) {
    const { agent, config } = context;

    // 从 LangGraph state 读取消息序列（注意：这是图内部 state 的 messages，不一定等于 UI 的 input.messages）
    const state = await agent.getState(config);
    const stateMessages = state.values.messages;
    const lastStateMessage = stateMessages?.[stateMessages.length - 1];

    // 判断最后一条 state message 是否包含 tool_calls
    const isLastMsgToolCall =
      lastStateMessage &&
      "tool_calls" in lastStateMessage &&
      (lastStateMessage as any).tool_calls?.length > 0;

    // tool_calls 形如：[{ name, id, args, ... }]
    const toolCalls = (lastStateMessage as any)?.tool_calls ?? [];

    // 命中任一忽略工具名就隐藏
    // 判断 `ignoredTools` 与 `toolCalls` 是否存在交集（即：是否命中需要隐藏输出的工具）
    // 用 Set 将查询从 O(n*m) 降为接近 O(n+m)
    const toolCallNames = new Set<string>(
      toolCalls.map((call: any) => String(call?.name ?? ""))
    );

    context.ignoreToolsMessage =
      isLastMsgToolCall &&
      DEFAULT_IGNORED_TOOLS.some((toolName) => toolCallNames.has(toolName));

    if (isLastMsgToolCall) {
      return {
        toolNmae: toolCalls[0]?.name,
      };
    }
    return {
      toolNmae: "",
    };
  }

  /**
   * 消费 `agent.streamEvents()` 的事件流，并转换为 AG-UI 事件向前端推送。
   *
   * 目前处理：
   * - on_chat_model_stream / on_llm_stream：
   *   - chunk.content => TEXT_MESSAGE_CHUNK（可被 ignoreToolsMessage 控制屏蔽）
   *   - chunk.tool_call_chunks => TOOL_CALL_CHUNK（用于前端展示工具调用/参数的增量）
   */
  private async handleStreamEvents(context: DeepResearchContext) {
    const { inputStream, observer, ignoreToolsMessage } = context;

    // 一个 run 内聚合文本增量的 messageId
    const messageId = Date.now().toString();
    context.messageId = messageId;

    // for-await 消费异步事件流，直到图执行完成或抛错
    for await (const event of inputStream) {
      // 兼容不同回调命名：chat model vs llm
      if (
        event.event === "on_chat_model_stream" ||
        event.event === "on_llm_stream"
      ) {
        const chunk = event.data.chunk;

        // LLM 文本增量：仅在不需要隐藏时透传给前端
        if (chunk.content && !ignoreToolsMessage) {
          observer.next({
            type: EventType.TEXT_MESSAGE_CHUNK,
            messageId,
            delta: chunk.content,
          } as any);
        }

        // 工具调用增量：透传给前端（用于显示工具调用/参数流式变化）
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
  }

  /**
   * 流结束后的收尾逻辑：
   * - 再次读取 state，看是否进入 interrupt（需要用户审批/决策）
   * - 若有 action_requests，则以 TOOL_CALL_CHUNK 的形式通知前端展示审批 UI
   * - 发送 RUN_FINISHED 并 complete Observable
   */
  private async handlePostExecution(context: DeepResearchContext) {
    const { agent, config, observer, messageId, input } = context;

    // 流结束后读取最终 state：用于判断是否需要进入 interrupt 交互
    const finalState = await agent.getState(config);
    console.log("finalState: ", finalState);

    if (
      finalState.tasks.length > 0 &&
      finalState.tasks[0].interrupts.length > 0
    ) {
      const interrupt = finalState.tasks[0].interrupts[0];
      console.log("Agent interrupted:", interrupt);

      const interruptValue = interrupt.value;

      // deep-research 约定：interrupt.value.action_requests[0] 描述需要前端确认的动作
      if (
        interruptValue &&
        interruptValue.action_requests &&
        interruptValue.action_requests.length > 0
      ) {
        const action = interruptValue.action_requests[0];

        // 通过 TOOL_CALL_CHUNK 通知前端：显示一个“待确认的工具调用/动作”
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
  }

  /**
   * 统一错误处理：
   * - 发出 RUN_ERROR 事件，便于前端展示错误
   * - 调用 observer.error 终止订阅链路
   */
  private handleError(context: DeepResearchContext, error: any) {
    const { observer } = context;

    observer.next({
      type: EventType.RUN_ERROR,
      message: error.message,
    } as any);

    observer.error(error);
  }
}
