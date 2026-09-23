/** 담당: 민규담당. 설정으로 주입한 정확한 Origin만 허용하며 인증은 수행하지 않는다. */
import type { RequestContext } from "../contracts/common.ts";
import { HttpError } from "./errors.ts";
import { jsonFailure } from "./response.ts";

export interface CorsPolicy {
  readonly allowedOrigins: readonly string[];
  readonly allowedMethods: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly allowCredentials?: boolean;
}

/** 함수 초기화 시 생성한다. wildcard·null·경로가 포함된 origin은 구성 오류다. */
export function createCors(policy: CorsPolicy) {
  const origins = new Set(policy.allowedOrigins);
  const methods = new Set(policy.allowedMethods);
  const allowedHeaders = new Set(policy.allowedHeaders.map((name) => name.toLowerCase()));
  for (const origin of origins) {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) throw new TypeError("정확한 HTTP origin을 설정해야 합니다.");
  }
  if (!methods.size || [...methods].some((value) => !/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(value)) ||
      [...allowedHeaders].some((value) => !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(value) || value === "*")) {
    throw new TypeError("CORS 메서드·헤더 설정이 올바르지 않습니다.");
  }
  const credentials = policy.allowCredentials === true;

  function responseHeaders(request: Request): Headers {
    const result = new Headers({ Vary: "Origin" });
    const origin = request.headers.get("origin");
    if (origin === null) return result;
    if (!origins.has(origin)) throw new HttpError("ACCESS_DENIED");
    result.set("Access-Control-Allow-Origin", origin);
    result.set("Access-Control-Expose-Headers", "X-Request-Id");
    if (credentials) result.set("Access-Control-Allow-Credentials", "true");
    return result;
  }
  function apply(response: Response, request: Request): Response {
    const additions = responseHeaders(request);
    const merged = new Headers(response.headers);
    const vary = new Set((merged.get("vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
    vary.add("Origin");
    additions.forEach((value, key) => { if (key !== "vary") merged.set(key, value); });
    merged.set("Vary", [...vary].join(", "));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
  }
  function preflight(request: Request, context: RequestContext): Response | null {
    if (request.method !== "OPTIONS" || !request.headers.has("access-control-request-method")) return null;
    let headers: Headers;
    try {
      headers = responseHeaders(request);
      if (!request.headers.has("origin")) throw new HttpError("INVALID_REQUEST");
      const method = request.headers.get("access-control-request-method")!;
      if (!methods.has(method)) throw new HttpError("METHOD_NOT_ALLOWED");
      const requested = request.headers.get("access-control-request-headers");
      const names = requested === null ? [] : requested.split(",").map((name) => name.trim().toLowerCase());
      if (names.some((name) => !allowedHeaders.has(name))) throw new HttpError("ACCESS_DENIED");
      headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
      headers.set("Access-Control-Allow-Methods", [...methods].join(", "));
      if (names.length) headers.set("Access-Control-Allow-Headers", names.join(", "));
      headers.set("Cache-Control", "no-store");
      return new Response(null, { status: 204, headers });
    } catch (error) {
      const response = jsonFailure(error, context);
      response.headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
      return response;
    }
  }
  return { responseHeaders, apply, preflight };
}
