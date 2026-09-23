/** 담당: 민규담당. 서버 요청 ID 생성, 제한된 크기의 UTF-8 JSON 읽기. */
import type { JsonValue, RequestContext } from "../contracts/common.ts";
import { HttpError } from "./errors.ts";

/** 클라이언트의 X-Request-Id를 받거나 재사용하지 않는다. */
export function createRequestContext(): RequestContext {
  return Object.freeze({ requestId: crypto.randomUUID() });
}

/** 한도는 호출자가 계약/설정에서 명시해야 하며 이 모듈은 운영 기본값을 정하지 않는다. */
export async function readJson(request: Request, options: { maxBytes: number }): Promise<JsonValue> {
  const { maxBytes } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new HttpError("INTERNAL_ERROR");
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType)) {
    throw new HttpError("UNSUPPORTED_MEDIA_TYPE");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") throw new HttpError("UNSUPPORTED_MEDIA_TYPE");
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw new HttpError("INVALID_REQUEST");
    if (BigInt(declared) > BigInt(maxBytes)) throw new HttpError("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new HttpError("INVALID_REQUEST");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        // 취소 완료를 기다리다 오류 응답이 지연되지 않게 한다.
        void reader.cancel().catch(() => {});
        throw new HttpError("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("INVALID_REQUEST");
  } finally {
    reader.releaseLock();
  }
  if (declared !== null && BigInt(declared) !== BigInt(length)) throw new HttpError("INVALID_REQUEST");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as JsonValue;
  } catch {
    throw new HttpError("INVALID_REQUEST");
  }
}
