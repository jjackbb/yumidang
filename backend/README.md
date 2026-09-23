# 유미당 백엔드 작업 안내

상태: 폴더와 구현용 파일의 골격 생성 완료. 신규 API·AI·외부 연동 기능은 미구현이다.

기준 문서는 [상세 설계](../PLAN_상세설계.md), [원본](../PLAN_원본.md), [프로젝트 지침](../AGENTS.md)이다. 담당 업무와 연결 계약은 상세 설계 11장을 먼저 확인한다.

**동시 수정 방지:** [ownership.json](ownership.json)이 파일별 단독 수정 담당을 정의한다. [협업 규칙](../docs/collaboration/README.md)에 따라 자기 파일만 수정하고 상대 담당 변경은 각자의 요청 폴더에 기록한다. AI 수정 전 경로 검사와 Git 커밋 검사를 사용한다.

## 기존 파일을 채우는 작업 방식

기능을 구현할 때 아래 표와 각 파일의 역할·담당·TODO를 확인하고 자기 담당 파일에 작성한다. 같은 기능의 다른 이름 파일이나 별도 백엔드·AI 폴더를 중복 생성하지 않는다. 새 파일이 필요하면 기존 모듈과 책임을 구분한다. 이 안내와 상세 설계는 민규가 갱신하며, 종현은 변경 요청을 남긴다.

현재 새 TypeScript 파일은 주석과 `export {};`만 가진 모듈이다. 요청을 수신하거나 성공 응답을 반환하지 않으며, DB·외부 모델을 호출하지 않는다. 주석의 TODO는 구현·검증 완료 후 실제 상태에 맞게 바꾼다. 파일이 존재한다는 이유만으로 구현 완료로 판단하지 않는다.

아래 경로에서 `functions/`는 `supabase/functions/`를, `_shared/`는 그 아래 공통 폴더를 뜻한다.

## 기능별 작성 위치

| 기능 | 작성할 파일·폴더 | 주담당 |
|---|---|---|
| 일반 API 진입·경로 연결 | functions/service-api/index.ts, handler.ts, routes.ts | 민규담당 |
| 가입·인증 요청 | functions/signup/, verification/의 index.ts·handler.ts | 민규담당 |
| 탐색·요약 요청 | functions/ai-chat/, review-summary-worker/의 index.ts·handler.ts | 종현담당 |
| 장소·행사·예약 실행 | functions/places/, event-sync/, scheduled-jobs/의 index.ts·handler.ts | 종현담당 |
| 사용자·내부 호출자·세션 | _shared/auth/ | 민규담당 |
| 환경·HTTP·공통 오류 | _shared/config/, http/ | 민규담당 |
| 실행 시 계약 검증 | _shared/contracts/ | search.ts·ai.ts는 종현, 나머지는 민규 |
| 업무 처리 | _shared/services/*-service.ts | search·event는 종현, 나머지는 민규 |
| DB 클라이언트 | _shared/db/user-client.ts, internal-client.ts | 민규담당 |
| DB 조회·RPC 연결 | _shared/db/repositories/ | search·events·review-summaries·jobs는 종현, 나머지는 민규 |
| 인증 제공사 연결 | _shared/integrations/identity·phone·email·bank의 port.ts·adapter.ts | 민규담당 |
| 장소·행사 제공사 연결 | _shared/integrations/places·events의 port.ts·adapter.ts, events/normalize.ts | 종현담당 |
| AI 탐색 | _shared/ai/Agents/chatbot/ | 종현담당 |
| AI 리뷰 요약 | _shared/ai/Agents/review-summary/ | 종현담당 |
| AI 모델 연결 | _shared/ai/providers/ | 종현담당 |
| 작업 등록·점유·재시도 | _shared/jobs/ | 종현담당 |
| 로그·민감 필드 제거 | _shared/observability/logger.ts, redaction.ts | 민규담당 |
| 공통 처리·AI 사용량 지표 | _shared/observability/metrics.ts | 종현담당 |
| 사람이 합의할 API 계약 | contracts/*.md | search·ai-chat·review-summary는 종현, 나머지는 민규 |
| DB 변경 | supabase/migrations/의 후속 변경 파일 | 민규가 통합, 종현은 필요한 변경안 제공 |
| 로컬 가상 데이터 | supabase/seeds/minkyu/, jonghyun/ | 각자 자기 폴더만 작성, 로드 설정은 민규 |

## AI 파일 상세

탐색 요청은 `functions/ai-chat/`에서 받고 `_shared/ai/Agents/chatbot/orchestrator.ts`로 연결한다. `context.ts`는 허용 문맥, `intent.ts`는 조건 검증, `date-range.ts`는 기간 계산, `tools.ts`는 공개 검색 도구를 맡는다. `prompts.ts`, `result-builder.ts`, `output-check.ts`에 지침·실제 카드 구성·결과 검증을 작성한다.

요약 작업은 `functions/review-summary-worker/`에서 받고 `_shared/ai/Agents/review-summary/orchestrator.ts`로 연결한다. `source-loader.ts`, `eligibility.ts`, `prompts.ts`, `evidence-check.ts`, `output-check.ts`, `publisher.ts`에 원문 조회·3개 기준·생성 지침·근거 검증·출력 검사·조건부 게시를 작성한다.

모델 호출 계약은 `_shared/ai/providers/model-port.ts`, 제공사 연결은 `provider-adapter.ts`, 오류 변환은 `provider-errors.ts`에 작성한다. 모델·공급사·예산은 아직 선정하지 않았다.

## 설정과 기존 자료

- `supabase/config.toml`은 주석만 있는 미구성 파일이다. 실행 가능한 로컬 설정은 민규가 검증해 작성한다.
- `supabase/functions/deno.json`은 빈 JSON 객체다. 의존성·명령·버전은 아직 설정하지 않았다.
- 기존 `test-phone-auth`, `test-institutional-email-auth`와 사본 파일은 보존한 자료이며 새 상용 인증으로 연결하지 않았다.
- 기존 마이그레이션은 수정하지 않았다. 신규 스키마가 합의되기 전에는 빈 마이그레이션을 만들지 않는다.
- 현재 `.gitkeep`은 기존 폴더 공유용 표시로 유지한다. 실제 코드 역할은 없다.
- 테스트·로컬 실행 도구는 별도 구현 단계에서 새로 작성한다. 현재 실행·배포 명령이 준비된 상태는 아니다.

## 구현 완료 확인

담당 기능의 계약을 채우고 `handler → service → repository / integration` 경로로 구현한다. AI는 허용 검색 도구와 모델 어댑터를 통해 동작하도록 연결한다. 관련 권한·정상·실패·동시 처리 사례를 검증한 후 코드 주석과 문서의 미구현 표시를 갱신한다. 미정 공급사나 정책을 가짜 성공 응답으로 대신하지 않는다.
