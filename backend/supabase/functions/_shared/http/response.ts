/** 담당: 민규담당. data/error와 동일한 서버 requestId를 본문·헤더에 반환한다. */
import type { ApiFailure, ApiSuccess, JsonValue, RequestContext } from "../contracts/common.ts";
import { toPublicError } from "./errors.ts";

function headers(context: RequestContext): Headers {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.requestId)) {
    throw new TypeError("서버에서 생성한 requestId가 필요합니다.");
  }
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": context.requestId,
  });
}

export function jsonSuccess<T extends JsonValue>(data: T, context: RequestContext, status = 200): Response {
  if (![200, 201, 202].includes(status)) throw new TypeError("JSON 성공 상태는 200, 201, 202만 지원합니다.");
  const envelope: ApiSuccess<T> = { data, requestId: context.requestId };
  return new Response(JSON.stringify(envelope), { status, headers: headers(context) });
}

/** error.message, stack, cause, SQL 및 외부 응답을 읽거나 기록하지 않는다. */
export function jsonFailure(error: unknown, context: RequestContext): Response {
  const mapped = toPublicError(error);
  const envelope: ApiFailure = { error: mapped.error, requestId: context.requestId };
  return new Response(JSON.stringify(envelope), { status: mapped.status, headers: headers(context) });
}
