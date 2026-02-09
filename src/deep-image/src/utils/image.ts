import { ImageInput } from "../types";

export function toImageUrlOrDataUrl(image?: ImageInput): string | undefined {
  if (!image) return undefined;
  if (image.url) return image.url;

  if (image.base64) {
    const mime = image.mimeType ?? "image/png";
    return `data:${mime};base64,${image.base64}`;
  }

  return undefined;
}