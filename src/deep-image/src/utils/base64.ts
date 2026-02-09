export function extractBase64Payload(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const dataUrlMatch = /^data:[^;]+;base64,(.*)$/i.exec(trimmed);
  const payload = (dataUrlMatch?.[1] ?? trimmed).replace(/\s+/g, "");
  if (!payload) return null;

  if (/^https?:\/\//i.test(payload)) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;

  const padLen = payload.length % 4;
  const padded =
    padLen === 0 ? payload : payload + "=".repeat((4 - padLen) % 4);

  try {
    const buf = Buffer.from(padded, "base64");
    if (buf.length === 0) return null;

    const a = padded.replace(/=+$/, "");
    const b = buf.toString("base64").replace(/=+$/, "");
    if (a !== b) return null;

    return payload;
  } catch {
    return null;
  }
}

export function isBase64(input: string): boolean {
  return extractBase64Payload(input) !== null;
}