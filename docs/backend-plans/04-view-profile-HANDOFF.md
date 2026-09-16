# 기능 4. 상대 프로필 조회 구현 인수인계

기준일: 2026-09-16 · 계획 원문: `04-view-profile.md` (PLAN_ONLY 보존)  
상태: **구현·원격 적용·원격/브라우저 검증 PASS**

## 정정 기록

- 계획 선행 조건 "기능 1이 `nickname`이면 `real_name`으로 정리"를 기능 1 감사에서 처리했다(`20260916101123_profiles_real_name_contract`).
- 화면·문서의 `닉네임`은 **마스킹된 실명**, `20대`는 **`25살` 형식 만 나이**로 해석·구현했다.
- 기존 프로토타입 `maskRealName`은 4글자를 `남궁*수`로 가렸다. 최신 규칙 `변종현미 → 변**미`로 서버·클라이언트를 일치시켰다.

## 실제 변경 파일

- `supabase/migrations/20260916101123_profiles_real_name_contract.sql` — `mask_real_name`, `korean_age`, `private` 스키마 (원격 적용)
- `supabase/migrations/20260916105738_feature04_post_author_profile.sql` — `get_post_author_profile` (원격 적용)
- `supabase/migrations/20260916114036_rpc_unavailable_errors_as_404.sql` — 조회 불가 오류를 HTTP 404로 (원격 적용)
- `src/utils/maskName.ts`, `src/live/PostDetail.tsx`(`AuthorProfileSheet`, `ProfileCard`), `src/live/api.ts`
- `tests/auth.test.ts`, `tests/harness/feature-04-profile.mjs`, `tests/harness/full-cycle.mjs`(4단계)

## 응답 계약 (새 테이블 없음)

| 응답 키 | 형식 | 출처 | 공개 이유 |
|---|---|---|---|
| `masked_name` | text | `mask_real_name(profiles.real_name)` 서버 계산 | 원본 없이 상대 구분 |
| `age` | integer | `korean_age(birth_date, 서울 오늘)` 서버 계산 | 만 나이 표시(`25살`) |
| `avatar_url` | text/null | `profiles.avatar_url` | 사진 또는 기본 이미지 |
| `bio` | text/null | `profiles.bio` | 소개 또는 "아직 자기소개를 작성하지 않았어요." |

반환하지 않음: `real_name`, `birth_date`, 전화번호, `auth.users` 메타데이터, `created_at/updated_at`, 지역·성별·취미·당도·후기·인증 배지.

마스킹: 공백 제거 후 1글자 `*`, 2글자 `변*`, 3글자 이상 첫·끝 글자 + 가운데 `*` 개수 유지(`변*현`, `변**미`).

## 권한과 이유

- `profiles` 본인 행 전용 RLS·열 권한은 그대로다. 타인 원본 SELECT 정책을 열지 않았다.
- `get_post_author_profile(post_id)`: SECURITY DEFINER(`search_path=''`), **authenticated만** 실행. 서버가 `post_id → posts.author_id`를 계산하고 삭제·없는 공고·프로필 없음은 같은 `profile_unavailable`(HTTP 404)로 응답해 상태를 구분할 수 없게 했다.
- `mask_real_name`, `korean_age`는 테이블을 읽지 않는 순수 함수이며 authenticated만 실행(anon 차단).

## 실행 명령과 실제 결과

| 검사 | 계층 | 결과 |
|---|---|---|
| 원격 SQL: `변종→변*`, `변종현→변*현`, `변종현미→변**미`, 2000-02-29 출생 2026-02-28=25/03-01=26, 생일 당일/전날 | REMOTE | PASS |
| `npm run harness:04` — B가 A를, A가 B를 네 키만으로 조회, 서버 나이 = 기존 `ageOn()`, null 사진·소개 정상, anon 거부, 삭제·없는 공고 동일 오류, A가 B 원본 조회 0행, 본인 생년월일만 조회 | REMOTE | PASS (5/5) |
| 전체 사이클 4단계 — B 화면에 A의 `하***이 · N살`, 페이지 HTML에 원본 실명·생년월일 없음, anon은 로그인 창 | BROWSER | PASS |
| 프로필 닫은 뒤 공고 상세 유지 | BROWSER | PASS (같은 단계에서 "공고로 돌아가기" 후 상세 닫기 수행) |
| 사진 업로드·소개 수정 | — | NOT_RUN (범위 밖) |

## 남은 위험

- 실명 입력은 신분증 검증이 아니며 화면에 인증 배지를 만들지 않았다.
- 차단·탈퇴 사용자 처리 정책은 없다.
- 재실행: `npm run harness:04`
