import chalk from "chalk";
function isContainerBase64String(str: string) {
  return str.startsWith("data:image/") && str.includes(";base64,");
}

function truncateImageDataUrlBase64(str: string, maxLen = 100) {
  if (!str) return str;

  const base64Marker = ";base64,";
  const idx = str.indexOf(base64Marker);
  if (idx === -1) return str;

  const prefix = str.slice(0, idx + base64Marker.length);
  const payload = str.slice(idx + base64Marker.length);

  if (!isContainerBase64String(prefix)) return str;
  if (payload.length <= maxLen) return str;

  return `${prefix}${payload.slice(0, maxLen)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeLogValue(value: any, seen: WeakSet<object>, depth: number): any {
  if (value == null) return value;

  if (typeof value === "string") {
    return truncateImageDataUrlBase64(value);
  }

  if (typeof value !== "object") return value;

  if (seen.has(value)) return "[Circular]";
  if (depth <= 0) return value;

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, seen, depth - 1));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: typeof value.message === "string" ? truncateImageDataUrlBase64(value.message) : value.message,
      stack: typeof value.stack === "string" ? truncateImageDataUrlBase64(value.stack) : value.stack,
    };
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeLogValue(v, seen, depth - 1);
    }
    return out;
  }

  return value;
}

export class FriendlyLog {
  log(msg: string, ...args: any[]) {
    const safeMsg = truncateImageDataUrlBase64(msg);
    const safeArgs = args.map((arg) => sanitizeLogValue(arg, new WeakSet<object>(), 6));
    console.log(chalk.blue(`[DeepImage Info] ${safeMsg}`), ...safeArgs);    
  }
  error(msg: string, ...args: any[]) {
    const safeMsg = truncateImageDataUrlBase64(msg);
    const safeArgs = args.map((arg) => sanitizeLogValue(arg, new WeakSet<object>(), 6));
    console.error(chalk.red(`[DeepImage Error] ${safeMsg}`), ...safeArgs);    
  }
  warn(msg: string, ...args: any[]) {
    const safeMsg = truncateImageDataUrlBase64(msg);
    const safeArgs = args.map((arg) => sanitizeLogValue(arg, new WeakSet<object>(), 6));
    console.warn(chalk.yellow(`[DeepImage Warn] ${safeMsg}`), ...safeArgs);    
  }
  success(msg: string, ...args: any[]) {
    const safeMsg = truncateImageDataUrlBase64(msg);
    const safeArgs = args.map((arg) => sanitizeLogValue(arg, new WeakSet<object>(), 6));
    console.log(chalk.green(`[DeepImage Success] ${safeMsg}`), ...safeArgs);    
  }
}

export const logger = new FriendlyLog();
