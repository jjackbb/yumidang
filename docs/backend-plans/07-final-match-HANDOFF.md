# 기능 7. 최종 동행 확정 구현 인수인계

기준일: 2026-09-16 · 계획 원문: `07-final-match.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격/브라우저 검증 PASS**

## 실제 변경 파일

- `supabase/migrations/20260916110758_feature07_final_match.sql` — 원격 적용 (version `20260916110758`)
- `supabase/migrations/20260916111437_appointments_request_post_fk_index.sql` — 성능 Advisor 복합 FK 인덱스 (원격 적용)
- `supabase/migrations/20260916114036_rpc_unavailable_errors_as_404.sql`
- 화면: `src/live/Chat.tsx`(확정 버튼·확정 시트·상태 배너), `src/live/Appointment.tsx`(확정된 동행 패널·정확한 장소), `src/live/MePage.tsx`(확정된 동행 목록), `src/live/PostDetail.tsx`(확정 동행자 장소 표시)
- 테스트: `tests/harness/feature-07-match.mjs`, `tests/harness/full-cycle.mjs`(7~8단계)

## `public.appointments`

| 키 | 형식 | 필수 | 제약·기본값 | 의미 |
|---|---|:-:|---|---|
| `id` | uuid | O | PK | 확정 동행 식별자(완료·평가 연결) |
| `post_id` | uuid | O | FK → `posts.id` CASCADE, **UNIQUE** | 공고당 동행 1건 |
| `join_request_id` | uuid | O | **UNIQUE**, 복합 FK `(join_request_id, post_id)` → `join_requests(id, post_id)` | 선택 요청과 공고 일치 강제 |
| `status` | text | O | 기본 `confirmed`, CHECK confirmed/completed(기능 8) | 동행 상태 |
| `confirmed_at` | timestamptz | O | 기본 `now()` | 확정 트랜잭션 서버 시각 |
| `updated_at` | timestamptz | O | 트리거 | 마지막 변경 |
| `completed_at` | timestamptz | X | 기능 8 추가 | 완료 시각 |

참가자 ID는 저장하지 않는다: 작성자 = `posts.author_id`, 동행자 = `join_requests.requester_id`. 정확한 장소는 복사하지 않는다.

`join_requests.status`에 `matched`(동행 확정), `not_selected`(다른 동행자와 확정)를 추가했다.

## 권한과 이유

| 역할 | appointment 조회 | 정확한 장소 | 확정 |
|---|:-:|:-:|:-:|
| anon / 관계없는 회원 / 선택되지 않은 신청자 | X | X | X |
| 확정된 신청자 | O | O | X |
| 공고 작성자 | O | O | O |

- `confirm_match(request_id)` (SECURITY DEFINER): 요청 → **공고 행 잠금** → 작성자·삭제 여부 확인 → 같은 공고 appointment가 있으면 같은 요청은 기존 결과(`already_confirmed=true`), 다른 요청은 `already_matched` → 요청 `pending`, 공고 `recruiting`, 시작 전, 정확한 장소 존재 검사 → pending 요청 잠금 → ①appointment 생성 ②선택 요청 `matched` ③나머지 pending `not_selected` ④공고 `closed`를 한 트랜잭션에서 처리. 하나라도 실패하면 전부 롤백.
- `appointments` SELECT RLS: `private.appointment_role(id)` (작성자·확정 동행자). 쓰기 권한 없음.
- `post_private_details` 정책 교체: 작성자 **또는** `private.is_confirmed_companion(post_id)`.
- 신청자의 동의는 참여 요청 + 확정 전 취소 가능성으로 본다(두 번째 확인 버튼 없음).

## 실행 명령과 실제 결과

최종 통합 run: `npm run test:harness` → `run-20260916T115621-lu3w` 전 단계 PASS (증거 `docs/backend-implementation/evidence/run-20260916T115621-lu3w/`).

| 검사 | 계층 | 결과 |
|---|---|---|
| `npm run harness:07` — 확정 전 B·C 장소 0행, 신청자·다른 신청자·anon·없는 요청 확정 거부, A가 B 확정 시 4개 변경 동시 반영, 재시도 동일 appointment·다른 요청 거부·1건, 두 요청 동시 확정(3건 병렬) → appointment 1건·matched/not_selected, A·B만 장소 조회·C·anon 불가·공개/목록/대화 응답에 장소 없음, appointment A·B만, matched 채팅 전송·not_selected 읽기 전용·matched 취소 불가, 시작 후 확정 실패 시 요청·공고·appointment·장소 변화 없음, REST 직접 쓰기 거부 | REMOTE | PASS (10/10) |
| 전체 사이클 7~8단계 — A 확정 시트에 저장된 장소·"확정하면 다른 신청은 종료됩니다." 표시, 확정 후 공고 closed, B 화면이 새로고침 없이 `동행 확정`·정확한 장소 표시, C는 장소 0행·화면에 없음 | BROWSER | PASS |

## 실패와 수정

- 첫 구현에서 조회 불가 오류(`P0002`)가 PostgREST에서 HTTP 500으로 나가 C의 브라우저 콘솔에 서버 오류로 기록됨 → 신규 마이그레이션으로 `PT404`(HTTP 404)로 정정. 권한 동작은 동일.

## 남은 위험

- 확정 취소·일정/장소 변경·노쇼 처리 없음(범위 밖).
- 재실행: `npm run harness:07`
