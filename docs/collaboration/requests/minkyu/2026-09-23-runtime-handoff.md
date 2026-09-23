# 3차 업무 런타임 연결 — 민규 → 종현

2026-09-23. 민규 worktree `minkyu/foundation-harness`에서 구현했다. 작성 당시 미커밋이었으며 이후 사용자가 구현과 재개 기록의 커밋·푸시를 요청했다. 최신 상태는 Git 로그와 민규 현황을 확인한다. 외부 메시지 전송 없이 이 문서로 전달한다. 종현 담당 파일은 수정하지 않았다. 1차 가상 사례와 2차 DB 계약에 이어 아래 실제 런타임 계약을 사용한다.

## 준비된 기능과 계약

- [서비스 API](../../../../backend/contracts/service-api.md): 사용자 JWT로 공고·신청·양측 매칭·채팅·알림·완료·후기를 호출한다. 응답은 공통 `{data,requestId}` / `{error,requestId}`다.
- [인증/DB](../../../../backend/contracts/auth-runtime.md): Supabase Auth의 `/auth/v1/user` 검증 후 원래 JWT로 사용자 RPC를 실행한다. service role은 내부 경로만 사용한다.
- [공고/매칭 DB](../../../../backend/contracts/core-service-db.md): 무료 공고만 신규 경로에서 지원한다. 양측 동의 전 상세 장소는 비공개이며 조건 버전은 무작위 UUID다. 중복 동의·겹치는 일정·직접 쓰기 우회를 방어한다.
- [완료 DB](../../../../backend/contracts/completion-db.md): 한쪽 확인만으로 완료하지 않는다. 양쪽 확인 또는 자동 처리로 완료한다. 사용자 확정에 따라 자동 완료의 실제 처리 시각부터 후기 7일을 계산한다.
- [후기 자동화](../../../../backend/contracts/review-automation-db.md): 공개 자격 확인, 기존 명시적 숨김 보존, revision 무효화와 durable outbox, 3개 이상 텍스트의 중복 없는 요약 작업 등록을 제공한다.
- [검색](../../../../backend/contracts/public-post-search-db.md), [요약](../../../../backend/contracts/review-summary-db.md), [작업 큐](../../../../backend/contracts/worker-jobs.md)는 2차 RPC 계약을 유지한다. 모델 생성·출력 검증·게시 호출은 종현 어댑터에 연결한다.

## 종현이 자기 폴더에서 연결할 작업

1. `scheduled-jobs/`에서 `POST /functions/v1/service-api/internal/maintenance`를 JSON `{ "limit": 100 }`과 별도 `Authorization: Bearer <INTERNAL_WORKER_SECRET>`으로 호출한다. limit은 1..100의 명시값이다. 사용자 JWT나 service-role key를 이 비밀로 대신 보내지 않는다. 호출 주기·배치 크기·재시도 운영 값은 별도 확정한다. 이번에는 새 예약 실행을 등록하지 않았다.
2. endpoint는 `process_due_completions(p_limit)` 다음 `process_review_automation(p_limit,p_model_version,p_prompt_version)`를 실행한다. 둘은 별도 DB 트랜잭션이다. 앞 단계만 성공한 뒤 실패해도 재호출로 안전하게 회복하도록 구현했다. `data.completion`과 `data.reviews` 구조 및 실제 키는 서비스 API 계약을 따른다.
3. `_shared/jobs/`와 `review-summary-worker/`에서 큐 점유·lease·fencing token·실패 재시도를 연결한다. job payload는 profileId/sourceRevision/modelVersion/promptVersion만 포함한다. 후기 원문·사용자 토큰을 큐에 저장하지 않는다.
4. `_shared/ai/Agents/review-summary/`에서 snapshot을 조회하고 실제 모델로 생성한 뒤 전체 근거 집합과 revision으로 조건부 게시한다. 409 충돌은 최신 원문 재조회 대상이며 오래된 결과를 강제 게시하지 않는다. 명시적으로 숨긴 후기나 3개 미만 원문은 요약에 사용하지 않는다.
5. 자기 검색 repository와 chatbot에서 새 검색 RPC를 연결한다. 등록 주소의 검색 일치와 반환 권한은 분리된다. 현재 service-api의 사용자 공고 조회는 로그인 필수이며 비로그인 검색 endpoint는 종현 소관이다.

## 필요한 실행 설정

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`(정확한 origin의 JSON 배열), `MAX_REQUEST_BYTES`, `UPSTREAM_TIMEOUT_MS`가 사용자 API 필수다. 내부 자동화에는 `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_WORKER_SECRET`, `REVIEW_SUMMARY_MODEL_VERSION`, `REVIEW_SUMMARY_PROMPT_VERSION`도 필요하다. 실제 비밀은 저장소나 요청 문서에 넣지 않는다. 테스트 버전 `integration-fixture`는 운영 모델 선택이 아니다.

service-api는 자체 인증을 하므로 `config.toml`의 해당 함수에만 `verify_jwt=false`를 설정했다. gateway가 내부 비밀을 JWT로 해석해 차단하지 않도록 한다. 사용자 요청의 Auth 검증과 내부 비밀 검증은 계속 필수다. [Supabase 인증 안내](https://supabase.com/docs/guides/functions/auth)를 참고한다. Edge 호스팅 기동·gateway 검증은 NOT_RUN이며 배포 전에 별도 확인한다. 로컬 HTTP 통합 PASS를 호스팅 PASS로 해석하지 않는다.

## 검증 증거와 보류

현재 26개 SQL 재생, 단위 검사 81개, rollback SQL 스위트 6개, 독립 DB 세션 경쟁 6개, 실제 Auth/JWT·HTTP 통합 8개 PASS다. 세부 결과와 최신 숫자는 [민규 현황](../../minkyu.md), 재현 방법은 [로컬 안내](../../../../tools/local/README.md)를 따른다.

PASS/문자 신규 가입·세션 발급, 계좌 검증과 유료 공고, 계좌 효력 변경 후 확정, 분쟁 세부 판단은 미정/미연결이다. 칭찬 키워드 catalog는 합의된 목록이 없어 비어 있으며 빈 praises는 제출할 수 있다. 기존 수동 완료자의 분쟁 제한은 그대로 남아 있다. 기존 후기 자동 backfill·완료 이력 재작성은 하지 않았다. 프런트엔드·외부 AI·예약 실행·운영 배포의 전체 연결은 아직 완료되지 않았다.

상대 파일의 변경이 필요하면 종현 요청 폴더에 정확한 경로·필요 계약을 기록하고 민규 소유 파일을 직접 수정하지 않는다.
