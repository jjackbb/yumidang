/** 담당: 민규담당. HTTP 공통 계약만 구현; 인증·DB·업무별 스키마는 별도 계약. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type PublicErrorCode =
  | "AUTH_REQUIRED" | "ACCESS_DENIED" | "RESOURCE_NOT_FOUND"
  | "INVALID_REQUEST" | "STATE_CONFLICT" | "EXTERNAL_UNAVAILABLE"
  | "INTERNAL_ERROR" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE"
  | "METHOD_NOT_ALLOWED";

export interface RequestContext { readonly requestId: string }
export interface PublicError {
  readonly code: PublicErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}
export interface ApiSuccess<T extends JsonValue = JsonValue> {
  readonly data: T;
  readonly requestId: string;
}
export interface ApiFailure {
  readonly error: PublicError;
  readonly requestId: string;
}
