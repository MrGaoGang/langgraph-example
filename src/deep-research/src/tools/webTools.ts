import { TavilySearch } from "@langchain/tavily";
import { tool } from "langchain";
import { z } from "zod";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_BASE = "https://api.tavily.com";

async function callTavily(endpoint: string, payload: Record<string, unknown>) {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY 未配置");
  }

  const response = await fetch(`${TAVILY_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily API error: ${response.status} ${text}`);
  }

  return response.json() as Promise<any>;
}

const tavilySearch = new TavilySearch({
  maxResults: 8,
  topic: "general",
});

export const webSearchTool = tool(
  async ({ query, searchDepth, timeRange }) => {
    const result = await (tavilySearch as any).invoke({
      query,
      ...(searchDepth ? { searchDepth } : {}),
      ...(timeRange ? { timeRange } : {}),
    });

    return typeof result === "string" ? result : JSON.stringify(result);
  },
  {
    name: "web_search",
    description: `
使用 Tavily 进行通用网络搜索，获取高质量搜索结果摘要。
适用于：快速了解一个主题、查找事实、获取多来源观点。
`.trim(),
    schema: z.object({
      query: z.string().describe("要查询的搜索关键词或问题"),
      searchDepth: z.enum(["basic", "advanced"]).optional(),
      timeRange: z.enum(["day", "week", "month", "year"]).optional(),
    }),
  }
);

/**
 * 根据 URL 抽取网页正文内容。
 *
 * 说明：LangChain 社区包里常用的是 TavilySearchResults；抽取/爬取这里用 Tavily REST API 补齐能力。
 */
export const webExtractTool = tool(
  async ({ url }) => {
    const json = await callTavily("extract", { url });
    return JSON.stringify(json);
  },
  {
    name: "web_extract",
    description: `
根据网页 URL 抽取网页正文内容，适合获取长文、报告、博客等的完整内容。
`.trim(),
    schema: z.object({
      url: z.string().url().describe("要抽取内容的网页 URL"),
    }),
  }
);

/**
 * 定向深度爬取某个网页及其子页面，根据指令提取特定信息。
 */
export const webCrawlTool = tool(
  async ({ url, instruction }) => {
    const json = await callTavily("crawl", {
      url,
      instruction,
      max_depth: 2,
    });
    return JSON.stringify(json);
  },
  {
    name: "web_crawl",
    description: `
对指定站点或网页进行深度爬取，并按照指令抽取特定内容。
适合需要对某个站点进行系统性信息收集的场景。
`.trim(),
    schema: z.object({
      url: z.string().url().describe("要爬取的初始 URL"),
      instruction: z
        .string()
        .describe("需要从该站点提取的内容说明，例如“提取所有定价信息”"),
    }),
  }
);

/**
 * 为 Simple Searcher 提供的轻量封装别名。
 */
export const tavilySearchTool = webSearchTool;