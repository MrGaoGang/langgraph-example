import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

import { DeepImageAgent } from "../src";
import type { DeepImagePlan, ImageInput } from "../src/types";
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
  console.log(`[plan] 图片已保存(url下载)：${outPath}`);
}

async function run() {
  const agent = new DeepImageAgent();

  const inputPath =
    process.env.DEEP_IMAGE_INPUT ?? path.resolve("test/assets/input.jpg");
  const image = loadLocalImageAsBase64(inputPath);
  const outDir = path.resolve("test/output");
  const stamp = Date.now();

  console.log("[plan] input:", { inputPath, hasImage: Boolean(image.base64) });

  // 1) 先产出计划
  const planResult = await agent.generate({
    mode: "PLAN",
    prompt:
      process.env.DEEP_IMAGE_PROMPT ??
      "游戏CG风格，极具艺术感、震撼人心，色彩丰富，暗部叠加，特写镜头，超高清。落叶飞溅、前景落叶虚化，动态模糊，背景动态虚化，阳光灿烂，蓝天白云，光影交错，仰拍特写镜头，突出速度感和视觉冲击力，强透视。原比例。原比例。原比例。原比例",
    image,
    context: process.env.DEEP_IMAGE_CONTEXT,
  });

  console.log("[plan] plan result:", JSON.stringify(planResult, null, 2));

  if (planResult.type !== "plan") {
    console.log("[plan] 未返回 plan，脚本结束。type=", planResult.type);
    return;
  }

  const plan: DeepImagePlan = planResult.plan;
  const planPath = path.join(outDir, `plan_${stamp}.json`);
  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(planPath, JSON.stringify(plan, null, 2), "utf-8");
  console.log(`[plan] 计划已保存：${planPath}`);

  // 2) 再基于计划执行（产图）
  const execResult = await agent.generate({
    mode: "PLAN",
    prompt:
      process.env.DEEP_IMAGE_EXEC_PROMPT ??
      "游戏CG风格，极具艺术感、震撼人心，色彩丰富，暗部叠加，特写镜头，超高清。落叶飞溅、前景落叶虚化，动态模糊，背景动态虚化，阳光灿烂，蓝天白云，光影交错，仰拍特写镜头，突出速度感和视觉冲击力，强透视。原比例。原比例。原比例。原比例",
    image,
    plan,
  });

  console.log("[plan] exec result:", JSON.stringify(execResult, null, 2));

  if (execResult.type === "image") {
    await saveGeneratedImage({
      image: execResult.image,
      outDir,
      name: `plan_exec_${stamp}`,
    });
  }
}

run();
