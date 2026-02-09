import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

import { DeepImageAgent } from "../src";
import type { ImageInput } from "../src/types";
import { extractBase64Payload, isBase64 } from "../src/utils/base64";

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function loadLocalImageAsBase64(filePath: string): ImageInput {
  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(
      `本地参考图不存在：${absPath}\n` +
        `请把图片放到该路径，或设置环境变量 DEEP_IMAGE_INPUT=你的图片路径。`
    );
  }

  const buf = fs.readFileSync(absPath);
  return {
    base64: buf.toString("base64"),
    mimeType: guessMimeType(absPath),
  };
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });

  const client = url.startsWith("https:") ? https : http;

  await new Promise<void>((resolve, reject) => {
    const req = client.get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume();
        downloadToFile(res.headers.location, outPath).then(resolve, reject);
        return;
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        const code = res.statusCode ?? "unknown";
        res.resume();
        reject(new Error(`下载失败: HTTP ${code} url=${url}`));
        return;
      }

      const file = fs.createWriteStream(outPath);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    });

    req.on("error", reject);
  });
}

async function saveGeneratedImage(params: {
  image: { format: "url" | "b64_json"; data: string };
  outDir: string;
  name: string;
}) {
  await fs.promises.mkdir(params.outDir, { recursive: true });

  if (isBase64(params.image.data)) {
    const outPath = path.join(params.outDir, `${params.name}.png`);
    const base64 = extractBase64Payload(params.image.data);
    if (!base64) throw new Error("图片数据看起来像 base64，但无法解析 payload");
    const buf = Buffer.from(base64, "base64");
    await fs.promises.writeFile(outPath, buf);
    console.log(`[simple] 图片已保存(base64)：${outPath}`);
    return;
  }

  const outPath = path.join(params.outDir, `${params.name}.png`);
  await downloadToFile(params.image.data, outPath);
  console.log(`[simple] 图片已保存(url下载)：${outPath}`);
}

async function run() {
  const agent = new DeepImageAgent();

  const inputPath =
    process.env.DEEP_IMAGE_INPUT ?? path.resolve("test/assets/input.jpg");
  const image = loadLocalImageAsBase64(inputPath);

  console.log("[simple] input:", { inputPath, hasImage: Boolean(image.base64) });

  const result = await agent.generate({
    mode: "SIMPLE",
    prompt: `Extract the main subject from the image,Create 9 anime emoticon IP characters based on user-entered pictures`,
    image
  });

  console.log("[simple] result:", JSON.stringify(result, null, 2));

  if (result.type === "image") {
    await saveGeneratedImage({
      image: result.image,
      outDir: path.resolve("test/output"),
      name: `simple_${Date.now()}`,
    });
  }
}

 run();