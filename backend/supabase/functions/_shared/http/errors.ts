/** 담당: 민규담당. 오류 원문을 직렬화하지 않는 공개 오류 변환. */
import type { PublicError, PublicErrorCode } from "../contracts/common.ts";

const definitions = {
  AUTH_REQUIRED: [401, "로그인이 필요합니다.", false],
  ACCESS_DENIED: [403, "요청을 수행할 권한이 없습니다.", false],
  RESOURCE_NOT_FOUND: [404, "대상을 찾을 수 없습니다.", false],
  INVALID_REQUEST: [400, "요청 형식이 올바르지 않습니다.", false],
  STATE_CONFLICT: [409, "현재 상태에서 요청을 처리할 수 없습니다.", false],
  EXTERNAL_UNAVAILABLE: [503, "외부 서비스를 일시적으로 사용할 수 없습니다.", true],
  INTERNAL_ERROR: [500, "요청 처리 중 오류가 발생했습니다.", false],
  PAYLOAD_TOO_LARGE: [413, "요청 본문이 허용 크기를 초과했습니다.", false],
  UNSUPPORTED_MEDIA_TYPE: [415, "지원하지 않는 요청 본문 형식입니다.", false],
  METHOD_NOT_ALLOWED: [405, "지원하지 않는 요청 방식입니다.", false],
} as const satisfies Record<PublicErrorCode, readonly [number, string, boolean]>;

const codes = new WeakMap<Error, PublicErrorCode>();
/** 검증된 내부 분기에서만 생성한다. DB/외부 오류의 code를 그대로 넘기지 않는다. */
export class HttpError extends Error {
  constructor(code: PublicErrorCode) {
    const safeCode = Object.hasOwn(definitions, code) ? code : "INTERNAL_ERROR";
    super(definitions[safeCode][1]);
    this.name = "HttpError";
    codes.set(this, safeCode);
  }
}

export function toPublicError(error: unknown): { status: number; error: PublicError } {
  const code = error instanceof Error ? codes.get(error) ?? "INTERNAL_ERROR" : "INTERNAL_ERROR";
  const [status, message, retryable] = definitions[code];
  return { status, error: { code, message, retryable } };
}
