import { createMiddleware } from "langchain";

export type ToolCallStatus = "start" | "end" | "error";

export interface ToolCallEvent {
  callId: string;
  name: string;
  args: any;
  status: ToolCallStatus;
  error?: unknown;
  timestamp: number;
}

type Listener<T> = (event: T) => void;

export class SimpleEventBus<T> {
  private listeners: Listener<T>[] = [];

  subscribe(listener: Listener<T>) {
    this.listeners.push(listener);
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      },
    };
  }

  emit(event: T) {
    this.listeners.forEach((listener) => listener(event));
  }
}

/**
 * 工具调用事件总线工厂
 * - 可通过注入自定义 Bus 复用同一条消息流
 * - 返回中包含 middleware 和可订阅的 bus
 */
export function createToolOutputMiddleware(
  bus?: SimpleEventBus<ToolCallEvent>
): {
  middleware: ReturnType<typeof createMiddleware>;
  bus: SimpleEventBus<ToolCallEvent>;
} {
  const eventsBus = bus ?? new SimpleEventBus<ToolCallEvent>();

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
      eventsBus.emit({
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
              eventsBus.emit({
                ...baseEvent,
                status: "end",
                timestamp: Date.now(),
              });
              return value;
            })
            .catch((err) => {
              eventsBus.emit({
                ...baseEvent,
                status: "error",
                error: err,
                timestamp: Date.now(),
              });
              throw err;
            });
        } else {
          eventsBus.emit({
            ...baseEvent,
            status: "end",
            timestamp: Date.now(),
          });
          return result;
        }
      } catch (e) {
        eventsBus.emit({
          ...baseEvent,
          status: "error",
          error: e,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
  });

  return {
    middleware,
    bus: eventsBus,
  };
}

/**
 * 默认的单例：保持与原来 `toolOutputMiddleware` 的用法兼容
 * - 其他地方可以直接 import `toolOutputEvents 监听事件
 */
const defaultBus = createToolOutputMiddleware();

export const toolOutputMiddleware = defaultBus.middleware;
export const toolOutputSubject = defaultBus.bus;
export const toolOutputEvents$ = defaultBus.bus;

