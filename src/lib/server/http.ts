import { ApiError } from "./db";
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(
    { data },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      },
    },
  );
}
export function fail(error: unknown) {
  if (error instanceof ApiError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error(
    "MQW request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "تعذّر إتمام العملية. حاول مجددًا." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const configured = process.env.MQW_APP_ORIGIN;
  let expected = url.origin;
  if (configured) {
    try {
      expected = new URL(configured).origin;
    } catch {
      throw new ApiError("إعداد مصدر التطبيق غير صالح.", 503);
    }
  } else {
    const host = request.headers.get("host");
    if (host) {
      if (!/^[a-zA-Z0-9.\-\[\]:]+$/.test(host))
        throw new ApiError("عنوان الطلب غير صالح.", 403);
      try {
        expected = new URL(`${url.protocol}//${host}`).origin;
      } catch {
        throw new ApiError("عنوان الطلب غير صالح.", 403);
      }
    }
  }
  if (
    !origin ||
    origin !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ApiError("الطلب غير مسموح من هذا المصدر.", 403);
}
export async function limitedBytes(
  request: Request,
  max: number,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new ApiError("حجم الطلب أكبر من المسموح.", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new ApiError("حجم الطلب أكبر من المسموح.", 413);
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = JSON.parse(
      new TextDecoder().decode(await limitedBytes(request, 524288)),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("بيانات الطلب غير صالحة.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ApiError("بيانات الطلب غير صالحة.");
  return data as Record<string, unknown>;
}
export function text(value: unknown, label = "النص", max = 10000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ApiError(`${label} مطلوب وبطول مناسب.`);
  return value.trim();
}
export function optionalText(value: unknown, max = 10000): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max)
    throw new ApiError("النص أطول من المسموح.");
  return value;
}
const limits = new Map<string, { count: number; until: number }>();
export function rateLimit(key: string, max = 12, ms = 60000) {
  const now = Date.now();
  const old = limits.get(key);
  if (old && old.until > now) {
    if (old.count >= max)
      throw new ApiError("محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.", 429);
    old.count++;
  } else limits.set(key, { count: 1, until: now + ms });
  if (limits.size > 20000)
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
}
