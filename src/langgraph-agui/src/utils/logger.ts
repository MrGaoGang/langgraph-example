
import chalk from "chalk";

type LogMethod = (message: unknown, ...optionalParams: unknown[]) => void;

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function format(level: string, message: unknown): string {
  return `[${level}] ${toText(message)}`;
}

export const logger: {
  success: LogMethod;
  info: LogMethod;
  warning: LogMethod;
  error: LogMethod;
} = {
  success: (message, ...optionalParams) => {
    console.log(chalk.green(format("SUCCESS", message)), ...optionalParams);
  },
  info: (message, ...optionalParams) => {
    console.info(chalk.blue(format("INFO", message)), ...optionalParams);
  },
  warning: (message, ...optionalParams) => {
    console.warn(chalk.yellow(format("WARNING", message)), ...optionalParams);
  },
  error: (message, ...optionalParams) => {
    console.error(chalk.red(format("ERROR", message)), ...optionalParams);
  },
};

export default logger;