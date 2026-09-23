/** 민규담당. Request → 호출자 인증 → 엄격한 입력 → 서비스 → RPC 연결. 원문 로그 없음. */
import type { RpcClient } from "../_shared/db/transport.ts";
import { createCors } from "../_shared/http/cors.ts";
import { HttpError } from "../_shared/http/errors.ts";
import { createRequestContext, readJson } from "../_shared/http/request.ts";
import { jsonFailure, jsonSuccess } from "../_shared/http/response.ts";
import { resolveRouteForMethod, type MaintenanceConfig } from "./routes.ts";

export interface ServiceApiDependencies {
  allowedOrigins: readonly string[];
  maxBodyBytes: number;
  authenticateUser(request: Request): Promise<RpcClient>;
  authenticateInternal(request: Request): Promise<RpcClient>;
  maintenance?: MaintenanceConfig;
}
export function createServiceApi(dependencies: ServiceApiDependencies) {
  if (!Number.isSafeInteger(dependencies.maxBodyBytes) || dependencies.maxBodyBytes < 1) throw new TypeError("본문 크기 제한이 필요합니다.");
  const cors = createCors({ allowedOrigins: dependencies.allowedOrigins, allowedMethods: ["GET", "POST"], allowedHeaders: ["authorization", "content-type", "apikey"] });
  return async (request: Request): Promise<Response> => {
    const context = createRequestContext();
    const preflight = cors.preflight(request, context);
    if (preflight) return preflight;
    let originAllowed = false;
    try {
      cors.responseHeaders(request);
      originAllowed = true;
      const url = new URL(request.url);
      const route = resolveRouteForMethod(url, request.method);
      // 내부 secret 경로와 사용자 JWT 경로 사이에 인증 fallback을 하지 않는다.
      const db = await (route.internal ? dependencies.authenticateInternal(request) : dependencies.authenticateUser(request));
      if (request.method === "GET" && request.body !== null) throw new HttpError("INVALID_REQUEST");
      const body = request.method === "POST" ? await readJson(request, { maxBytes: dependencies.maxBodyBytes }) : null;
      const data = await route.execute({ db, url, body, maintenance: dependencies.maintenance });
      return cors.apply(jsonSuccess(data, context), request);
    } catch (error) {
      const response = jsonFailure(error, context);
      return originAllowed ? cors.apply(response, request) : response;
    }
  };
}
