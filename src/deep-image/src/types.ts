export type DeepImageMode = "AUTO" | "SIMPLE" | "PLAN";

export type DeepImageOutputFormat = "b64_json" | "url";

export interface ImageInput {
  url?: string;
  base64?: string;
  mimeType?: string;
}

export interface DeepImageRequest {
  prompt: string;
  image?: ImageInput;

  /**
   * AUTO: 由系统判断 SIMPLE/PLAN
   * SIMPLE: 直接出图
   * PLAN: 先产出计划，再基于确认后的计划执行
   */
  mode?: DeepImageMode;

  /**
   * PLAN 模式下：
   * - plan 不存在时：generate 返回 plan
   * - plan 存在时：generate 执行该 plan 并返回 image
   */
  plan?: DeepImagePlan;

  /** 额外上下文（业务背景、对话摘要等） */
  context?: string;

  output?: {
    size?: string; // e.g. "1024x1024"
    format?: DeepImageOutputFormat; // "b64_json" | "url"
    model?: string; // e.g. "gpt-image-1"
  };
}

export interface DeepImageDecision {
  mode: Exclude<DeepImageMode, "AUTO">;
  reasoning: string;
}

export interface DeepImagePlanStep {
  id: string;
  title: string;
  instruction: string;
  rationale?: string;
}

export interface DeepImagePlan {
  goal: string;
  finalPrompt: string;
  negativePrompt?: string;
  size?: string;
  steps: DeepImagePlanStep[];
}

export interface GeneratedImage {
  format: DeepImageOutputFormat;
  /** b64_json 时返回 base64；url 时返回 url */
  data: string;
  model?: string;
  size?: string;
}

export type DeepImageResult =
  | {
      type: "plan";
      mode: "PLAN";
      decision: DeepImageDecision;
      plan: DeepImagePlan;
      raw?: unknown;
    }
  | {
      type: "image";
      mode: Exclude<DeepImageMode, "AUTO">;
      decision: DeepImageDecision;
      image: GeneratedImage;
      usedPlan?: DeepImagePlan;
      raw?: unknown;
    };