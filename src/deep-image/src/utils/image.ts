import { ImageInput } from "../types";
import { isBase64 } from "./base64";

export function toImageUrlOrDataUrl(image?: ImageInput): string | undefined {
  if (!image) return undefined;
  if (image.url) return image.url;

  if (isBase64(image.base64 ?? "")) {
    const mime = image.mimeType ?? "image/png";
    return `data:${mime};base64,${image.base64}`;
  }

  return undefined;
}