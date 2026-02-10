import { Buffer } from "node:buffer";
import { OpenAI, type ChatCompletionMessage } from "openai";
import { DeepImageOutputFormat, GeneratedImage } from "../types";
import { defaultSystemPrompt } from "../prompt/system-prompt";
import { logger } from "../utils/friendly-log";

let cachedClient: OpenAI | undefined;

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0 ? 1 : x;
}

function normalizeAspectRatio(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "16:9";
  }

  const g = gcd(width, height);
  const w = Math.max(1, Math.round(width / g));
  const h = Math.max(1, Math.round(height / g));
  const reduced = `${w}:${h}`;

  const supported: Array<{ ar: string; r: number }> = [
    { ar: "1:1", r: 1 },
    { ar: "4:3", r: 4 / 3 },
    { ar: "3:2", r: 3 / 2 },
    { ar: "16:9", r: 16 / 9 },
    { ar: "21:9", r: 21 / 9 },
    { ar: "3:4", r: 3 / 4 },
    { ar: "2:3", r: 2 / 3 },
    { ar: "9:16", r: 9 / 16 },
  ];

  if (supported.some((s) => s.ar === reduced)) return reduced;

  const ratio = width / height;
  let best = supported[0];
  let bestDiff = Math.abs(ratio - best.r);
  for (const s of supported) {
    const diff = Math.abs(ratio - s.r);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best.ar;
}

function parsePngSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < pngSig.length; i++) if (buf[i] !== pngSig[i]) return null;
  const width = (buf[16] << 24) | (buf[17] << 16) | (buf[18] << 8) | buf[19];
  const height = (buf[20] << 24) | (buf[21] << 16) | (buf[22] << 8) | buf[23];
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseGifSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const header = String.fromCharCode(...buf.slice(0, 6));
  if (header !== "GIF87a" && header !== "GIF89a") return null;
  const width = buf[6] | (buf[7] << 8);
  const height = buf[8] | (buf[9] << 8);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseJpegSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 4) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 3 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;

    const length = (buf[offset + 2] << 8) | buf[offset + 3];
    if (length < 2 || offset + 2 + length > buf.length) return null;

    const isSOF =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSOF) {
      if (offset + 2 + length < offset + 9) return null;
      const height = (buf[offset + 5] << 8) | buf[offset + 6];
      const width = (buf[offset + 7] << 8) | buf[offset + 8];
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }

    offset += 2 + length;
  }

  return null;
}

function parseWebpSize(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const riff = String.fromCharCode(...buf.slice(0, 4));
  const webp = String.fromCharCode(...buf.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;

  const chunk = String.fromCharCode(...buf.slice(12, 16));

  if (chunk === "VP8X") {
    if (buf.length < 30) return null;
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    if (w <= 0 || h <= 0) return null;
    return { width: w, height: h };
  }

  if (chunk === "VP8 ") {
    if (buf.length < 30) return null;
    const start = 20;
    if (buf[start + 3] !== 0x9d || buf[start + 4] !== 0x01 || buf[start + 5] !== 0x2a) return null;
    const w = buf[start + 6] | (buf[start + 7] << 8);
    const h = buf[start + 8] | (buf[start + 9] << 8);
    const width = w & 0x3fff;
    const height = h & 0x3fff;
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }

  if (chunk === "VP8L") {
    if (buf.length < 25) return null;
    const start = 20;
    if (buf[start] !== 0x2f) return null;
    const b0 = buf[start + 1];
    const b1 = buf[start + 2];
    const b2 = buf[start + 3];
    const b3 = buf[start + 4];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    if (width <= 0 || height <= 0) return null;
    return { width, height };
  }

  return null;
}

function parseImageSize(buf: Uint8Array): { width: number; height: number } | null {
  return parsePngSize(buf) ?? parseGifSize(buf) ?? parseJpegSize(buf) ?? parseWebpSize(buf);
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, "");
  // Node.js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeBuf = Buffer.from(clean, "base64");
  return new Uint8Array(nodeBuf.buffer, nodeBuf.byteOffset, nodeBuf.byteLength);
}

async function inferAspectRatioFromImageUrl(url: string): Promise<string | undefined> {
  try {
    if (url.startsWith("data:")) {
      const m = url.match(/^data:([^;]+);base64,(.*)$/);
      if (!m) return undefined;
      const bytes = decodeBase64ToBytes(m[2]);
      const size = parseImageSize(bytes);
      if (!size) return undefined;
      return normalizeAspectRatio(size.width, size.height);
    }

    if (/^https?:\/\//i.test(url) && typeof fetch === "function") {
      const res = await fetch(url, {
        headers: {
          // Try to avoid downloading the whole image
          Range: "bytes=0-65535",
        },
      });
      if (!res.ok) return undefined;
      const ab = await res.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const size = parseImageSize(bytes);
      if (!size) return undefined;
      return normalizeAspectRatio(size.width, size.height);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getOpenRouterClient() {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing env: OPENROUTER_API_KEY (required for OpenRouter image generation)"
    );
  }

  cachedClient = new OpenAI({
    baseURL: process.env.IMAGE_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders:
      process.env.OPENROUTER_HTTP_REFERER || process.env.OPENROUTER_X_TITLE
        ? {
            ...(process.env.OPENROUTER_HTTP_REFERER
              ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
              : {}),
            ...(process.env.OPENROUTER_X_TITLE
              ? { "X-Title": process.env.OPENROUTER_X_TITLE }
              : {}),
          }
        : undefined,
  });

  return cachedClient;
}

/**
 * 通过 OpenRouter 的多模态模型生成图片。
 * 说明：OpenRouter 的图片模型通常通过 `chat.completions` 返回 `message.images`（URL 列表）。
 */
export async function generateImage(params: {
  prompt: string;
  /** 参考图片（url 或 data url） */
  imageUrls?: string[];
  /** 一些模型不支持结构化 size 参数，这里会注入到 prompt 中 */
  size?: '2K' | '4K' | '1K';
  /** OpenRouter 图片模型通常返回 url；保留该字段用于对齐对外类型 */
  format?: DeepImageOutputFormat;
  /** OpenRouter 模型名，例如：google/gemini-2.5-flash-image-preview */
  model?: string;
  /** 可选 system prompt */
  systemPrompt?: string;
}): Promise<GeneratedImage> {
  const client = getOpenRouterClient();

  const model =
    params.model ?? process.env.IMAGE_MODEL ?? "google/gemini-2.5-flash-image";

  const format: DeepImageOutputFormat = params.format ?? "url";

  const contents: any[] = [
    {
      type: "text",
      text:  params.prompt,
    },
  ];
  if (!params.imageUrls?.length) {
    throw new Error("imageUrls is required");
  }
  logger.log(`[image] imageUrls: ${params.imageUrls?.length}`);
  (params.imageUrls ?? []).forEach((url) => {
    contents.push({
      type: "image_url",
      image_url: { url },
    });
  });
  const inferredAspectRatio = params.imageUrls?.[0]
    ? await inferAspectRatioFromImageUrl(params.imageUrls[0])
    : undefined;
  const aspectRatio = inferredAspectRatio ?? "16:9";
  logger.log(`[image] aspect_ratio: ${aspectRatio}`);

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        {
          role: "system",
          content: params.systemPrompt ?? defaultSystemPrompt,
        },
        {
          role: "user",
          content: contents,
        },
      ],
      // @ts-ignore
      image_config: {
        aspect_ratio: aspectRatio,
        image_size: params?.size ?? "2K",
      },
    }
  );

  const msg = response.choices?.[0]?.message as
    | (ChatCompletionMessage & {
        images?: { image_url: { url: string } }[];
      })
    | null;

  const urls = msg?.images
    ?.map((ele: any) => ele?.image_url?.url)
    .filter(Boolean);
  const firstUrl = urls?.[0];

  if (!firstUrl) {
    const fallback = typeof msg?.content === "string" ? msg.content : "";
    throw new Error(
      `OpenRouter image generation returned no images. content=${fallback}`
    );
  }
  logger.success(`[image] generated image url:`, firstUrl);

  return {
    format: format === "b64_json" ? "url" : format,
    data: firstUrl,
    model,
    size: params.size,
  };
}
