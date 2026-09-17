# 기능 8. 확정된 동행 완료 구현 인수인계

> 2026-09-17 정책 변경으로 이 문서의 양쪽 확인 계약은 이전 이력이다. 현재 계약은 `docs/backend-implementation/POLICY-IMPLEMENTATION-2026-09-17.md`를 따른다.

기준일: 2026-09-16 · 계획 원문: `08-complete-appointment.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격/브라우저 검증 PASS**

## 실제 변경 파일

- `supabase/migrations/20260916110943_feature08_completion.sql` — 원격 적용 (version `20260916110943`)
- `supabase/migrations/20260916114036_rpc_unavailable_errors_as_404.sql`
- 화면: `src/live/Appointment.tsx`(완료 버튼·서버 시각 안내·양쪽 상태)
- 테스트: `tests/harness/feature-08-completion.mjs`, `tests/harness/helpers/data.mjs`(`shortAppointment`), `tests/harness/full-cycle.mjs`(9·10·12단계)

## 데이터 키

### `public.appointment_completion_confirmations`

| 키 | 형식 | 필수 | 제약 | 의미 |
|---|---|:-:|---|---|
| `appointment_id` | uuid | O | PK(복합)·FK → `appointments.id` CASCADE | 완료 확인한 동행 |
| `user_id` | uuid | O | PK(복합)·FK → `profiles.id` CASCADE, RPC가 `auth.uid()` | 확인한 참가자 |
| `confirmed_at` | timestamptz | O | 기본 `now()` | 서버 확인 시각 |

복합 PK `(appointment_id, user_id)` → 1인 1회. 취소·삭제 권한 없음.

### `public.appointments` 추가

| 키 | 형식 | 제약 | 의미 |
|---|---|---|---|
| `completed_at` | timestamptz | CHECK `(status='completed') = (completed_at is not null)` | 두 번째 확인이 성공한 서버 시각 |
| `status` | text | CHECK confirmed/completed | 두 번째 확인과 같은 트랜잭션에서 `completed` |

`one_confirmed`는 저장하지 않고 확인 행 수로 계산한다.

## 권한과 이유

- `confirm_appointment_completion(appointment_id)` (SECURITY DEFINER): **appointment 행 잠금** → 참가자 확인(`appointment_unavailable`, HTTP 404) → `now() >= posts.ends_at` 아니면 `too_early` → 확인 행 `ON CONFLICT DO NOTHING`(재시도 멱등) → 2건이고 `confirmed`면 `completed`+`completed_at` 기록 → 내·상대 확인 시각 반환. 사용자 ID 파라미터 없음.
- `get_appointment_state`: 일정·공개 지역·상대 마스킹 이름, 내/상대 확인 시각, 서버 판단 `can_confirm_completion`, `server_now`.
- 확인 행 SELECT RLS는 두 참가자만. 직접 INSERT/UPDATE/DELETE 없음.
- 평가 작성 자격 = **본인 확인 행 존재**(상대 확인과 무관). 기능 9 `get_appointment_review_state.can_write`가 사용한다.
- 브라우저 시계가 아닌 DB `now()`만 사용한다. 화면 버튼도 서버가 준 `can_confirm_completion`으로 활성화된다.

## 실행 명령과 실제 결과

최종 통합 run: `npm run test:harness` → `run-20260916T115621-lu3w` 전 단계 PASS (증거 `docs/backend-implementation/evidence/run-20260916T115621-lu3w/`).

| 검사 | 계층 | 결과 |
|---|---|---|
| `npm run harness:08` — 종료 전 두 사람 `too_early`·행 없음·평가 자격 없음, C·anon 조회/확인 거부, 종료 후 A 더블클릭 → 행 1개·`confirmed` 유지·A만 평가 가능·B는 상대 확인 표시, 사용자 파라미터 위조·직접 INSERT·DELETE 거부, B 확인 → `completed`+`completed_at`, 재시도 시 `completed_at` 불변·행 2개, 두 사람 동시 확인 → 행 2개·완료 1회, 응답에 원본 개인정보·장소 없음 | REMOTE | PASS (7/7) |
| 전체 사이클 9·10·12단계 — 종료 전 버튼 비활성 + 서버 `too_early`, 종료 후 A 확인 `내 완료 확인됨 · 상대 확인 대기`, B 확인 후 **두 화면 모두** `동행 완료`(A는 새로고침 없음) | BROWSER | PASS |
| 브라우저 시계 조작으로 우회 | BROWSER | NOT_RUN (서버 `now()` 판정은 REMOTE로 검증) |

## 테스트 일정 제어

종료 시각 검사는 **이번 run이 만든 테스트 공고의 일정만** 짧게(시작 +12초·종료 +20초, 브라우저 사이클은 +6분·+7분) 잡아 실제 서버 시각이 지나기를 기다렸다. 운영 데이터와 브라우저 시계는 건드리지 않았다.

## 남은 위험

- 자동 완료·노쇼·분쟁 처리 없음. 한쪽이 끝내 확인하지 않으면 `confirmed`로 남는다(계획대로).
- 재실행: `npm run harness:08`
