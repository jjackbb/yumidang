# 기능 9. 블라인드 상호 평가 구현 인수인계

> 2026-09-17 정책 변경으로 이 문서의 상호 제출 전용 공개 계약은 이전 이력이다. 현재 계약은 `docs/development/backend-implementation/POLICY-IMPLEMENTATION-2026-09-17.md`를 따른다.

기준일: 2026-09-16 · 계획 원문: `09-mutual-review.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격/브라우저 검증 PASS** (실제 7일 대기는 관리자 보조 1회 검증)

## 실제 변경 파일

- `supabase/migrations/20260916111030_feature09_mutual_review.sql` — 원격 적용 (version `20260916111030`)
- `supabase/migrations/20260916114036_rpc_unavailable_errors_as_404.sql`
- 화면: `src/live/Appointment.tsx`(`ReviewBlock`: 별점·한마디·제출 확인·대기/공개)
- 테스트: `tests/harness/feature-09-reviews.mjs`, `tests/harness/manual/review-deadline-prepare.mjs`, `tests/harness/manual/review-deadline-verify.mjs`, `tests/harness/full-cycle.mjs`(10·11·13~15단계)

## `public.appointment_reviews`

| 키 | 형식 | 필수 | 제약·기본값 | 의미 |
|---|---|:-:|---|---|
| `id` | uuid | O | PK | 평가 행 |
| `appointment_id` | uuid | O | FK → `appointments.id` CASCADE | 평가한 동행 |
| `reviewer_id` | uuid | O | FK → `profiles.id` CASCADE, RPC가 `auth.uid()` | 평가자 |
| `rating` | smallint | O | CHECK 1~5 | 별점 |
| `comment` | text | X | 공백 제거, 빈 값은 null, 1~300자 | 한마디 |
| `submitted_at` | timestamptz | O | 기본 `now()` | 제출 서버 시각 |

UNIQUE `(appointment_id, reviewer_id)`. 저장하지 않음: `reviewee_id`(두 참가자 관계로 계산), `updated_at`(수정 없음), `released_at`, `post_id`.

## 권한과 이유

- 테이블에 anon·authenticated **권한도 정책도 없다**(RLS만 켬). 원본 행은 조회·쓰기·Realtime 모두 불가. Advisor INFO "RLS Enabled No Policy"는 이 의도적 전면 차단이다.
- `submit_appointment_review(appointment_id, rating, comment)` (SECURITY DEFINER): appointment 행 잠금 → 참가자 → 본인 완료 확인 → 별점·길이 → 같은 내용 재시도는 현재 상태 반환, 다른 내용은 `already_submitted` → `review_submission_open(ends_at, now())`(`now < ends_at + 7일`) → INSERT → 상태 반환.
- `get_appointment_review_state(appointment_id)`: `my_completion_confirmed`, `deadline_at`, `can_write`, `own_review`, `peer_submitted`(존재 여부만), `released`, `peer_review`(**두 평가가 모두 있을 때만**), `server_now`. 기한이 지나도 공개 조건은 바뀌지 않는다.
- 공개된 평가도 두 참가자만 본다. 공개 프로필 후기·평균 별점·당도 없음.
- 화면은 원본 대신 이 RPC를 5초 간격·창 포커스 때 재조회한다.

## 실행 명령과 실제 결과

최종 통합 run: `npm run test:harness` → `run-20260916T115621-lu3w` 전 단계 PASS (증거 `docs/development/backend-implementation/evidence/run-20260916T115621-lu3w/`).

| 검사 | 계층 | 결과 |
|---|---|---|
| `npm run harness:09` — 종료 후라도 본인 완료 전 제출 거부, 원본 테이블 A/B/C/anon SELECT·INSERT 거부, `appointment_reviews` Realtime 구독 이벤트 0건, A 완료 후 B 미완료 상태에서 제출 가능, 0/6점·301자 거부·잔여 행 없음, 같은 내용 동시 재시도 OK·다른 내용 `already_submitted`, B는 `peer_submitted=true`·내용 null·B가 보는 다른 RPC 응답에도 A 한마디 없음, A는 상대 평가 null, C·anon 존재 여부도 거부, B 완료 후 블라인드 제출 → 양쪽 동시 공개, 평가가 완료 행·appointment 상태를 바꾸지 않음, 거의 동시 제출 → 일관된 공개, 기한 경계 `ends_at+7일-1ms` 열림/정각 닫힘 + `deadline_at` 일치, 응답에 원본 개인정보·장소 없음 | REMOTE | PASS (10/10) |
| 관리자 보조 1회 — run 공고 1건의 일정만 SQL로 8일 앞당긴 뒤 B 제출 `review_deadline_passed`, A 한쪽 평가 B에게 비공개 유지, A도 `released=false` | REMOTE | PASS (`run-dev-deadline`) |
| 전체 사이클 10·11·13~15단계 — A 완료 직후 5점+한마디 제출·"상대 평가 대기", B 화면은 제출 사실만·HTML에 A 한마디 없음, B 블라인드 제출 후 B 화면에 A 평가·A 화면에 새로고침 없이 B 평가, 새로고침·로그아웃·재로그인 뒤 유지 | BROWSER | PASS |
| 실제 7일 경과 대기 | — | NOT_RUN |

## 남은 위험

- 평가 신고·숨김·운영 검토, 알림 없음. 공개 프로필 반영은 별도 결정 필요.
- 재실행: `npm run harness:09`
