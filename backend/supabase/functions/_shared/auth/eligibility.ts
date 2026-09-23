/** 민규담당: 공급사가 검증한 근거의 순수 해석. 근거 조회/발급/신규 가입은 아직 연결하지 않았다. */
import { getPrincipalToken, type Principal } from "./principal.ts";
export type EligibilityState = "verification_required" | "photo_required" | "eligible";
/** 신뢰된 공급사 어댑터/비공개 DB 조회가 제공해야 한다. 요청 본문·user_metadata에는 사용 금지. */
export interface TrustedSignupProof {
  readonly source: "pass";
  readonly userId: string;
  readonly qualificationVerified: boolean;
  readonly diUnique: boolean;
  readonly profilePhotoPresent: boolean;
}
/** 상태 계산일 뿐 DB 등록을 허가하거나 기존 수기 가입 자료를 PASS 근거로 전환하지 않는다. */
export function evaluateTrustedEligibility(principal: Principal, proof: TrustedSignupProof | null): EligibilityState {
  getPrincipalToken(principal);
  if (!proof || proof.source !== "pass" || proof.userId !== principal.userId || proof.qualificationVerified !== true || proof.diUnique !== true) return "verification_required";
  return proof.profilePhotoPresent === true ? "eligible" : "photo_required";
}
