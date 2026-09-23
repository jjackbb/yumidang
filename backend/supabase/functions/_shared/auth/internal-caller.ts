/** 민규담당: 사용자 JWT/서비스 키와 다른 내부 전용 비밀을 검증한다. */
import { requireInternalConfig, type RuntimeConfig } from "../config/env.ts";
import { HttpError } from "../http/errors.ts";
import { readBearer } from "./principal.ts";
export async function requireInternalCaller(request: Request, config: RuntimeConfig): Promise<void> {
  const { workerSecret } = requireInternalConfig(config);
  const presented = readBearer(request);
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(presented)),
    crypto.subtle.digest("SHA-256", encoder.encode(workerSecret)),
  ]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  if (different !== 0) throw new HttpError("ACCESS_DENIED");
}
