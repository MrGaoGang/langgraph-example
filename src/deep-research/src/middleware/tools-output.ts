import { createMiddleware } from "langchain";
import { Subject, Observable } from "rxjs";

export type ToolCallStatus = "start" | "end" | "error";

export interface ToolCallEvent {
  callId: string;
  name: string;
  args: any;
  status: ToolCallStatus;
  error?: unknown;
  timestamp: number;
}

/**
 * 工具调用事件总线工厂
 * - 可通过注入自定义 Subject 复用同一条消息流
 * - 返回中包含 middleware 和可订阅的 events$
 */
export function createToolOutputMiddleware(
  subject?: Subject<ToolCallEvent>
): {
  middleware: ReturnType<typeof createMiddleware>;
  subject: Subject<ToolCallEvent>;
  events$: Observable<ToolCallEvent>;
} {
  const eventsSubject = subject ?? new Subject<ToolCallEvent>();

  const middleware = createMiddleware({
    name: "ToolOutputMiddleware",
    wrapToolCall: (request, handler) => {
      const callId = request.toolCall.id ?? Date.now().toString();
      const baseEvent = {
        callId,
        name: request.toolCall.name,
        args: request.toolCall.args,
      } as const;

      // 开始执行
      eventsSubject.next({
        ...baseEvent,
        status: "start",
        timestamp: Date.now(),
      });

      try {
        const result = handler(request);

        // 兼容同步 / Promise 两种情况
        if (result && typeof (result as any).then === "function") {
          return (result as Promise<any>)
            .then((value) => {
              eventsSubject.next({
                ...baseEvent,
                status: "end",
                timestamp: Date.now(),
              });
              return value;
            })
            .catch((err) => {
              eventsSubject.next({
                ...baseEvent,
                status: "error",
                error: err,
                timestamp: Date.now(),
              });
              throw err;
            });
        } else {
          eventsSubject.next({
            ...baseEvent,
            status: "end",
            timestamp: Date.now(),
          });
          return result;
        }
      } catch (e) {
        eventsSubject.next({
          ...baseEvent,
          status: "error",
          error: e,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
  });

  const events$ = eventsSubject.asObservable();

  return {
    middleware,
    subject: eventsSubject,
    events$,
  };
}

/**
 * 默认的单例：保持与原来 `toolOutputMiddleware` 的用法兼容
 * - 其他地方可以直接 import `toolOutputEvents$` 监听事件
 */
const defaultBus = createToolOutputMiddleware();

export const toolOutputMiddleware = defaultBus.middleware;
export const toolOutputSubject = defaultBus.subject;
export const toolOutputEvents$ = defaultBus.events$;

