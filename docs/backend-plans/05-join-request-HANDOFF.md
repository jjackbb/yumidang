# 기능 5. 동행 참여 요청 구현 인수인계

기준일: 2026-09-16 · 계획 원문: `05-join-request.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격/브라우저 검증 PASS**

## 실제 변경 파일

- `supabase/migrations/20260916105916_feature05_join_requests.sql` — 원격 적용 (version `20260916105916`)
- 기능 7 마이그레이션이 상태 CHECK에 `matched`, `not_selected`와 `UNIQUE(id, post_id)`를 추가
- `20260916114036_rpc_unavailable_errors_as_404.sql` — `post_unavailable`/`request_unavailable`을 HTTP 404로
- 화면: `src/live/PostDetail.tsx`(요청 작성·기존 요청 상태), `src/live/MePage.tsx`(보낸/받은 요청, 취소·거절), `src/live/Chat.tsx`(대화 화면 취소·거절)
- 테스트: `tests/harness/feature-05-requests.mjs`, `tests/harness/full-cycle.mjs`(5단계), `tests/live.test.ts`(상태 문구)

## `public.join_requests`

| 키 | 형식 | 필수 | 제약·기본값 | 의미 |
|---|---|:-:|---|---|
| `id` | uuid | O | PK, `gen_random_uuid()` | 요청 = 매칭 대화 식별자 |
| `post_id` | uuid | O | FK → `posts.id` CASCADE | 신청 공고 |
| `requester_id` | uuid | O | FK → `profiles.id` CASCADE, RPC가 `auth.uid()` | 신청자 |
| `message` | text | O | 공백 제거 10~300자 | 작성자에게 보내는 소개 |
| `status` | text | O | 기본 `pending`, CHECK pending/withdrawn/declined/matched/not_selected | 상태 |
| `created_at` / `updated_at` | timestamptz | O | 기본 `now()`, 트리거 | 요청·마지막 상태 변경 시각 |

UNIQUE `(post_id, requester_id)` — 같은 공고 한 번만(취소·거절 후 재신청 불가). UNIQUE `(id, post_id)` — 기능 7 복합 FK용. 인덱스 `(requester_id, created_at desc)`, `(post_id, created_at desc)`.

화면 문구: `pending`=매칭 대화 중, `withdrawn`=신청 취소, `declined`=신청 거절, `matched`=동행 확정, `not_selected`=다른 동행자와 확정.

저장하지 않는 값: 작성자 ID·공고 제목·신청자 이름/나이/사진·정확한 장소(모두 관계에서 계산).

## 권한과 이유

| 역할 | 조회 | 변경 |
|---|---|---|
| anon | 없음 | 없음 |
| 신청자 | 자기 요청 | `withdraw_join_request` (pending → withdrawn) |
| 공고 작성자 | 자기 공고의 요청 | `decline_join_request` (pending → declined) |
| 관계없는 회원 | 없음 | 없음 |

- RLS SELECT: `requester_id = auth.uid()` 또는 `private.is_post_author(post_id)`. 테이블 INSERT/UPDATE/DELETE 권한 없음.
- `create_join_request(post_id, message)`: 로그인·프로필 확인 → **공고 행 잠금** → 자기 공고 거부 → 기존 요청이면 `already_existed=true`로 그대로 반환(연속 클릭·두 탭 → 1건) → 모집 상태·마감·시작 서버 시각 검사 → 메시지 길이 → INSERT. 신청자 ID 파라미터가 없다.
- 취소·거절: 요청 행 잠금, 주체 불일치는 모두 같은 `request_unavailable`, 이미 같은 상태면 멱등 반환, 그 밖 전이는 `invalid_transition`.
- 목록 RPC `list_sent_join_requests`/`list_received_join_requests`와 `get_request_counterpart_profile`은 서버에서 `mask_real_name`·`korean_age`만 반환한다. 원본 실명·생년월일·전화번호·ID 열(`requester_id`, `author_id`)을 응답에 넣지 않는다.

## 실행 명령과 실제 결과

| 검사 | 계층 | 결과 |
|---|---|---|
| `npm run harness:05` — anon 생성/조회 거부, B 요청 1건·서버가 신청자 결정·메시지 trim, 신청자 파라미터 위조 거부, 반복·병렬 4회 → 1건, 자기 공고/마감/삭제/짧은 메시지 거부(행 없음), 목록 마스킹·나이·누출 없음, C 조회 불가, 상대 프로필 B↔A만, 타인 취소/거절 거부, 취소 멱등·이후 거절 거부·재신청 없음, 거절 후 취소 거부, REST 직접 쓰기 거부 | REMOTE | PASS (10/10) |
| 전체 사이클 5단계 — B가 UI로 요청, `매칭 대화 중` 표시, 재요청 `already_existed`·행 1개 | BROWSER | PASS |
| 받은 요청·보낸 요청 Me 화면 거절/취소 버튼 브라우저 클릭 | BROWSER | NOT_RUN (API로만 검증, 화면 버튼은 구현) |

## 실패와 수정

- 첫 단독 실행에서 "마감 공고 요청" 단계가 기능 3 공유 데이터를 요구해 NOT_RUN이 됐다. 단독 실행 시에도 자체 마감 공고를 만들도록 하네스를 수정했다.

## 남은 위험

- 재신청 제한 시간·제재 정책은 없다(계획 범위 밖). 알림 발송 없음.
- 재실행: `npm run harness:05`
