# 기능 3. 동행 공고 작성·목록·상세 구현 인수인계

기준일: 2026-09-16 · 구현: Claude Code · 계획 원문: `03-browse-posts.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격/브라우저 검증 PASS**

## 계획과 달라진 점 (최신 결정 반영)

- 계획서는 공고 작성 UI를 범위 밖으로 뒀지만, 작성자가 정확한 장소를 입력하도록 확정됐고 실제 한 사이클에 공고 생성이 필요하므로 **최소 공고 작성 + `posts`/`post_private_details` 원자적 저장**을 포함했다. 수정·삭제는 넣지 않았다.
- 카드의 `닉네임`/`20대` 표현은 사용하지 않는다. 작성자 정보는 기능 4의 마스킹 실명·만 나이 계약으로만 보여준다.
- 일반 실행은 샘플 공고 대신 Supabase만 사용한다(`src/live/`). 샘플은 `?demo=1`에서만 동작한다.

## 실제 변경 파일

- 마이그레이션 `supabase/migrations/20260916105220_feature03_posts.sql` — **원격 적용 완료** (version `20260916105220`)
- 후속 `20260916114036_rpc_unavailable_errors_as_404.sql` (오류 HTTP 상태 정정, 기능 3 함수는 변경 없음)
- 화면: `src/live/PostList.tsx`, `src/live/PostDetail.tsx`, `src/live/CreatePost.tsx`, `src/live/api.ts`, `src/live/format.ts`, `src/live/LiveApp.tsx`, `src/App.tsx`
- 테스트: `tests/live.test.ts`, `tests/harness/feature-03-posts.mjs`, `tests/harness/full-cycle.mjs`(2~3단계)

## 데이터 키

### `public.posts` (공개 가능한 정보만)

| 키 | 형식 | 필수 | 제약·기본값 | 의미 |
|---|---|:-:|---|---|
| `id` | uuid | O | PK. 작성 폼이 한 번 만든 UUID를 RPC에 전달(재시도 시 같은 공고 반환) | 공고 식별자 |
| `author_id` | uuid | O | FK → `profiles.id` ON DELETE CASCADE. RPC가 `auth.uid()`로 설정 | 작성자 |
| `title` | text | O | 공백 제거, 2~80자 | 제목 |
| `description` | text | O | 공백 제거, 1~2,000자 | 설명 |
| `category` | text | O | CHECK: 전시·축제·식사·운동·여행·클래스·산책·스터디·공연·쇼핑·기타 (기존 앱 분류) | 분류 필터 |
| `starts_at` / `ends_at` | timestamptz | O | CHECK `starts_at < ends_at` | 동행 시작·종료. 종료는 기능 8·9 기준 |
| `recruitment_ends_at` | timestamptz | O | CHECK `≤ starts_at`, RPC에서 `> now()` | 참여 요청 마감 |
| `public_area` | text | O | CHECK 60자 이하 + `시/도 시·군·구 [구] 동·읍·면·가` 정규식 | 공개 위치(시·구·동) |
| `preference_note` | text | X | 공백 제거, 1~300자 | 공개 선호 조건(자동 판정 없음) |
| `tags` | text[] | O | 기본 `{}`, 최대 5개(각 20자 이하는 RPC) | 태그 |
| `capacity` | smallint | O | 기본 2, CHECK `= 2` | 1:1 정원 |
| `status` | text | O | 기본 `recruiting`, CHECK recruiting/closed/expired/deleted | 공고 상태 |
| `created_at` / `updated_at` | timestamptz | O | 기본 `now()`, UPDATE 트리거 | 생성·변경 시각 |

인덱스: `(starts_at, id) where status='recruiting'`, `(author_id)`.

### `public.post_private_details` (비공개)

| 키 | 형식 | 필수 | 제약 | 의미 |
|---|---|:-:|---|---|
| `post_id` | uuid | O | PK·FK → `posts.id` CASCADE | 공고당 1행 |
| `exact_location` | text | O | 공백 제거, 2~200자 | 정확한 만남 장소 |
| `created_at` / `updated_at` | timestamptz | O | 기본 `now()`, 트리거 | 저장·변경 시각 |

## 권한과 이유

| 대상 | anon | 로그인 회원 | 작성자 | 확정 동행자(기능 7) |
|---|---|---|---|---|
| `posts` SELECT | `status<>'deleted'` | 같음 | 같음 | 같음 |
| `posts` INSERT/UPDATE/DELETE | 불가 | 불가(직접) | `create_post` RPC로만 생성 | — |
| `post_private_details` SELECT | 권한 없음 | 0행 | 자기 공고 | 확정 후 해당 공고 |
| `post_private_details` 쓰기 | 불가 | 불가 | RPC 내부만 | 불가 |

- `create_post`(SECURITY DEFINER, `search_path=''`, authenticated만 실행): 로그인·프로필 확인 → 같은 id 재시도는 기존 공고 반환(다른 작성자면 거부) → 모집 마감 미래 검사 → 태그 정리 → 두 테이블을 한 트랜잭션에 INSERT. 실패 시 부분 행이 남지 않는다.
- `list_posts`(INVOKER, anon/authenticated): 모집 중·마감 전·시작 전만, 검색(제목·설명·공개 지역, 와일드카드 이스케이프)·서울 날짜·분류·공개 지역 접두사 필터, `(starts_at,id)` keyset, 최대 50개(화면 20개).
- `post_request_window`(INVOKER): 상세 화면이 브라우저 시계 대신 **서버 시각**으로 신청 가능 여부를 판단.
- 정확한 장소를 공개 행과 분리해 목록·상세 API가 구조적으로 포함할 수 없게 했다.

## 실행 명령과 실제 결과

최종 통합 run: `npm run test:harness` → `run-20260916T115621-lu3w` 전 단계 PASS (증거 `docs/backend-implementation/evidence/run-20260916T115621-lu3w/`).

| 검사 | 계층 | 결과 |
|---|---|---|
| `npm run harness:03` — anon 생성 거부, A·B 생성(작성자=세션), 재시도 동일 공고·타인 id 재사용 거부, 잘못된 공개 위치/짧은 장소/과거 마감/시작≥종료/분류/태그 6개 거부 + 부분 행 없음, anon·A·B 동일 목록, 필터 4종·와일드카드, keyset 페이지(크기 1), 삭제 공고 비노출, 마감 공고 목록 제외·상세 열림·서버 시각 판정, 정확한 장소 작성자만, REST 직접 쓰기 거부 | REMOTE | PASS (11/11) |
| 단위: 공개 위치 형식, 작성 폼 검증, 서버 시각 상태 표시 | LOCAL | PASS |
| 전체 사이클 2~3단계: A·B UI 작성, 서로의 공고 확인, B·anon 상세에 시·구·동만·정확한 장소 없음 | BROWSER | PASS |
| 20개 단위 실제 페이지 경계(21개 이상 run 공고) | REMOTE | NOT_RUN — 운영 목록 오염을 피하려 크기 1 keyset으로 동일 로직만 검증 |
| 로딩·빈 결과·오류·재시도 화면 | BROWSER | 부분 — 로딩/목록 확인, 오류·빈 결과 화면은 수동 확인 없음(NOT_RUN) |

## 실패와 수정

- **앱 결함 수정:** 페이지를 새로 열면 세션 복구 전(익명) 목록이 먼저 그려지고, 복구 순간 사용자 기준으로 다시 마운트되며 입력 중인 검색어가 사라졌다(`run-20260916T114511-rrbb` 전체 사이클 2단계). 세션 복구가 끝난 뒤에만 화면을 그리도록 `LiveApp` 수정 → 최종 run PASS.
- 같은 run의 앞 단계 공고가 20개를 넘어 run_id 검색 첫 페이지에 전체 사이클 공고가 없던 문제는 하네스를 제목 검색으로 바꿔 해결.
- 하네스 첫 작성 시 검색어 `run_id B공고`가 제목 `[run_id] B공고`와 맞지 않아 테스트 기대값을 `run_id] B공고`로 수정(앱·DB 변경 없음).

## 남은 위험과 재실행

- 삭제·마감 상태를 바꾸는 작성자 기능은 아직 없다. `expired`는 저장되지 않고 목록 조건으로만 제외된다.
- 테스트 공고가 원격 목록에 최대 1시간 노출된다(run 태그 제목).
- 재실행: `npm run harness:03`
