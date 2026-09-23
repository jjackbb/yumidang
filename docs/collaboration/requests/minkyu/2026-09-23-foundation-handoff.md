# 종현 연결 전달 — 민규 foundation 1차

작성 담당: 민규. 종현은 읽기만 하고 답변은 자신의 요청 폴더에 별도 문서로 작성한다.

상태: 민규 전용 `minkyu/foundation-harness` worktree에서 준비 완료. 아직 커밋·푸시하지 않았으므로 원격에서 바로 사용할 수 있는 상태는 아니다. 외부 메시지를 발송한 기록이 아니다.

## 지금 연결할 수 있는 것

- [공통 계약](../../../../backend/contracts/conventions.md): `{data,requestId}` 또는 `{error:{code,message,retryable},requestId}`. requestId는 요청 진입 시 서버가 생성하고 같은 문맥을 성공·실패 응답에 사용한다.
- 실제 공통 모듈: `createRequestContext`, `readJson`, `HttpError`, `toPublicError`, `jsonSuccess`, `jsonFailure`, `createCors`. 호출자 인증·권한·공개 필드 투영·본문 크기·허용 출처 설정은 각 진입점에 연결해야 한다.
- [DB 연결 제안](../../../../backend/contracts/db-foundation.md)과 [가상 응답](../../../../tests/fixtures/minkyu/db-foundation.json): 공개 검색, 공개 후기 snapshot/revision, 요약 게시·조회, 작업 중복·점유·재시도 사례 24개.

종현은 자신의 AI·검색·행사·워커 파일에서 이 공통 모듈과 가상 DB 어댑터를 사용할 수 있다. 실제 SQL/RPC는 아직 없으며 문서의 의미 이름을 배포된 함수 이름으로 호출하지 않는다.

## 연결 시 지킬 경계

1. 주소 일치는 서버 내부에서 처리하고 공개 검색 카드에는 정확주소·상세 만남 지점·전체 실명·주소 일치 조각을 넣지 않는다. 실제 반환 필드는 종현의 검색 계약과 후속 합의한다.
2. 공개·공개 보류 종료·한마디가 있는 후기만 AI 입력 원문 후보로 사용한다. 후기 3개 기준, snapshot revision과 게시 직전 최신 상태 확인을 유지한다.
3. revision·lease 충돌 예시는 `STATE_CONFLICT`다. 가상 실패 사례 9개는 실제 공통 오류 메시지와 대조했다. 원문 오류·대화·후기·토큰을 응답이나 로그에 넣지 않는다.
4. 작업 상태는 기존 설계의 `queued`, `running`, `succeeded`, `retry_wait`와 맞췄다. 종료·공개 시간 정책은 워커가 재구현하지 않고 후속 민규 DB 경로에 맡긴다.
5. 가상 사례의 ID·시간 간격·데이터는 테스트용이다. 운영 한도·정책으로 복사하지 않는다. DB의 근거 ID 검증은 요약 문장의 사실성 검증을 대신하지 않는다.

## 종현이 요청할 수 있는 변경

종현 소유 어댑터에서 필요한 공개 카드 필드·공통 오류 코드·작업 응답이 다르면 자기 요청 문서에 정상/실패 예시와 이유를 기록한다. 민규 공통 계약·DB·설정을 직접 수정하지 않는다. 현재 실제 RPC를 기다리는 부분은 가상 어댑터로 분리하고 운영 성공처럼 노출하지 않는다.

## 검증과 미실행

- 공통 HTTP 11개, 가상 DB 계약 9개, 로컬 도구 17개, 하네스 5개 테스트 통과.
- 기존 DB 이력 20개 검사·임시 복사 해시 일치. 실제 SQL 실행 없음.
- Deno·Supabase CLI·Docker가 현재 PATH에 없어 Deno 타입 검사·실제 DB/RLS·Edge 실행은 `NOT_RUN`.
- 민규가 후속 DB 구현과 로컬 검증을 완료해야 실제 연결 단계로 넘어갈 수 있다. 외부 인증·AI 모델은 이번 작업에서 선정하거나 연동하지 않았다.
