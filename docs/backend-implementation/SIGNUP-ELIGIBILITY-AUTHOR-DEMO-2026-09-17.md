# 회원가입 성별 분기·작성자 성별/만 나이 구현 결과 — 2026-09-17

## 1. 결과 요약

- 대상은 Supabase `bndguguarijmghnkenvt` 한 곳으로 고정했다.
- 신규 여성은 휴대폰 세션과 유효한 기본정보만으로 가입을 완료한다.
- 신규 남성은 기존 가입 완료 여성의 재사용 가능한 추천 코드 또는 학교·직장 이메일 확인이 있어야 가입을 완료한다.
- 프로필 생성, 가입 경로, 추천 audit은 `complete_signup` 한 트랜잭션에서 처리한다. 일반 `authenticated` 역할의 직접 `profiles` INSERT와 성별 UPDATE는 제거했다.
- 기존 프로필 4개는 `legacy`로 등록해 추가 자격 확인 없이 기존 로그인을 유지한다.
- 로그인한 사용자만 공고 상세에서 서버 계산 결과인 `남성 · 만 30세` 형식의 작성자 정보를 본다. 익명 사용자는 RPC를 호출하지 않고 UI에도 표시하지 않는다.
- 여성 회원의 추천 코드는 Me에서 본인에게만 lazy/atomic 생성되며 재사용 안내와 복사를 제공한다.

## 2. 구현 항목

### DB·권한

- 원격 migration: `20260917043418 signup_eligibility_author_demographics`
- 로컬: `supabase/migrations/20260917043418_signup_eligibility_author_demographics.sql`
- private tables: `signup_eligibility`, `female_referral_codes`, `referral_signup_audit`, `institutional_email_verifications`
- 네 테이블 모두 RLS 활성화, `public`/`anon`/`authenticated` table grant 없음. 보안 Advisor의 `RLS enabled no policy` INFO는 이 deny-all 서버 전용 설계 때문에 의도된 결과다.
- 공개 RPC:
  - `complete_signup`: authenticated만 실행, auth UID 기준 원자/멱등 가입 완료
  - `get_or_create_my_referral_code`: 완료 여성 본인만 실행
  - `get_post_author_profile`: authenticated만 실행, 마스킹 이름·성별·서버 만 나이·사진·소개만 반환
- Edge 전용 RPC는 `service_role`만 실행하며 일반 authenticated에는 노출하지 않는다.
- 권한 실측: 직접 profile INSERT false, gender UPDATE false, bio UPDATE true, anon 가입/작성자 RPC false, authenticated 가입/작성자 RPC true.

### 테스트 기관 이메일

- Edge Function: `test-institutional-email-auth`, ACTIVE, version 2, `verify_jwt=true`
- 별도 활성 플래그와 만료: `TEST_INSTITUTIONAL_EMAIL_AUTH_ENABLED=true`, `TEST_INSTITUTIONAL_EMAIL_AUTH_EXPIRES_AT=2026-09-24T00:00:00Z`(2026-09-24 09:00 KST)
- 실제 메일을 보내지 않으며 고정 코드 `246810`을 서버가 판정한다.
- 같은 사용자·같은 이메일 요청 후 10분 내 확인, 이메일 변경 시 이전 확인 무효, 30초 요청 제한, 5회 실패 제한을 적용했다.
- Gmail/Naver/Daum/Kakao/Nate/Yahoo/Hotmail/Outlook/iCloud 계열을 거부하고, 완료 계정 간 기관 이메일을 중복 사용할 수 없다.
- 응답에는 이메일, JWT, service key, 가입 경로, 추천 관계를 담지 않는다.
- 비로그인 실제 endpoint 요청은 HTTP 401이었다.
- 기존 `test-phone-auth`는 version 4, `verify_jwt=false` 그대로이며 코드·secret·설정을 변경하지 않았다.

## 3. 검증

| 범위 | 결과 | 근거 |
|---|---|---|
| TypeScript | PASS | `npm run lint` |
| 단위/계약 | PASS | `npm test`, 101/101 |
| production build | PASS | `npm run build`; 기존 500 kB chunk 경고만 존재 |
| diff | PASS | `git diff --check` |
| 원격 migration | PASS | 원격 이력에 `20260917043418` 확인 |
| 나이 경계 | PASS | 서울 날짜 기준 정확히 19세=19, 생일 하루 전=18 |
| private tables | PASS | RLS true, 일반 역할 grant 없음 |
| Edge 배포 | PASS | ACTIVE, JWT verification true |
| 익명 Edge 요청 | PASS | 401, 데이터 변경 없음 |
| 모바일 브라우저 | PASS | 390×844 Chromium, 기존 계정만 사용 |

브라우저 실측:

- 익명 공고 상세: 작성자 demographic DOM 없음, `get_post_author_profile` 요청 0회.
- 기존 `010-****-5555` 계정: 추가 가입 조건 없이 로그인 유지.
- 로그인 공고 상세: RPC 1회, `남성 · 만 30세` 표시.
- 지정된 기존 공고 제목 6개가 모두 탐색 목록에 존재.
- 증거: [작성자 카드](evidence/signup-eligibility-author-20260917/logged-in-author-demographics.png)

신규 가입 원격 종단 테스트는 **NOT_RUN**이다. 원격에 새 Auth 사용자나 프로필을 남기지 않는 조건 때문에 계정 생성형 전체/기능 하네스를 실행하지 않았다. 여성/남성 분기, 코드 정규화, 무료 메일, 잘못된/올바른 고정 코드, 응답 비밀값 차단은 로컬 단위 테스트로 검증했고 DB 우회·RLS·함수 grant는 원격 SQL 계약으로 검증했다.

`npm run harness:preflight`는 로컬 4단계 후 샌드박스 네트워크에서 Auth fetch가 실패했다. 자동 생성 `STATE.md`/`state.json`을 이번 실측 PASS로 덮어쓰지 않았고, 생성된 실패 run도 제거했다. 같은 원격 대상은 프로젝트 고정 MCP와 승인된 CLI/브라우저로 별도 확인했다.

## 4. 데이터 보존과 기준 불일치

요청 문서에는 Auth 1 / profile 1 / post 6으로 적혀 있었으나 작업 직전 실제 원격은 이미 Auth 4 / profile 4 / post 10 / private detail 10이었다. 기존 데이터를 삭제해 문서 수량에 맞추지 않았다.

| 데이터 | 적용 전 | 적용 후 |
|---|---:|---:|
| Auth 사용자 | 4 | 4 |
| 프로필 | 4 | 4 |
| 공고 | 10 | 10 |
| 공고 private detail | 10 | 10 |
| 가입 자격 행 | 0 | 4 (`legacy`) |
| 추천 코드/audit/이메일 확인 | 0/0/0 | 0/0/0 |

지정 계정과 지정 공고 6개는 수정·삭제하지 않았다. 브라우저 검사도 로그인/조회만 수행했다.

## 5. Advisor와 제한

- 보안 Advisor의 authenticated SECURITY DEFINER 경고는 가입 완료·추천 코드·작성자 안전 프로필처럼 의도적으로 authenticated에 공개한, auth UID와 고정 `search_path=''`를 검사하는 RPC를 포함한다.
- 유출 비밀번호 보호 비활성은 기존 프로젝트 경고이며 이번 범위에서 Auth 설정을 변경하지 않았다.
- performance Advisor는 `referral_signup_audit.referrer_user_id` 보조 인덱스 부재 INFO를 표시했다. 현재 테스트 규모와 단일 신규 migration 범위를 유지해 추가 migration은 만들지 않았으며, 규모 확대 전 인덱스를 추가한다.
- 기관 이메일은 유저테스트용 고정 코드이며 실제 이메일 소유권 인증이 아니다. 만료 후 플래그를 연장하지 말고 운영 메일 공급자/일회성 코드 저장 방식으로 교체한다.
- 성별은 자기 선택 값이며 별도 검증 값이 아니다.

## 6. 후속 배포

- Git commit/push와 Vercel production 배포는 수행하지 않았다.
- 프런트 변경을 공개하려면 검토 후 commit/push하고 Vercel preview에서 모바일 가입·Me 추천 카드·로그인/로그아웃 상세를 확인한 뒤 production으로 승격한다.
- 2026-09-24 09:00 KST 이후 테스트 이메일 기능은 자동 비활성이다. 임의 연장하지 않는다.

참고한 Supabase 공식 문서: [Database Functions](https://supabase.com/docs/guides/database/functions), [Securing the Data API](https://supabase.com/docs/guides/database/hardening-data-api), [Edge Functions Auth](https://supabase.com/docs/guides/functions/auth), [Changelog](https://supabase.com/changelog?types=breaking-change).
