# 종현 연결 전달: 실제 DB RPC 2차

작성: 민규. 대상: 종현의 검색·후기 요약·작업 저장소 어댑터. 외부 전송 없음.

전용 worktree `.worktrees/minkyu-foundation`, 브랜치 `minkyu/foundation-harness`에 구현했다. 아직 커밋·푸시하지 않았으므로 다른 복제본에 자동 반영되지 않는다. 1차 가상 명세의 의미 이름을 그대로 RPC 이름으로 호출하지 말고 아래 실제 계약을 따른다.

| 종현 담당 연결 | 민규 제공 RPC | 상세 계약 |
|---|---|---|
| 검색 repository / search-service | `search_public_posts` | [검색 DB](../../../../backend/contracts/public-post-search-db.md) |
| 요약 source-loader / publisher | `load_public_review_snapshot`, `publish_review_summary` | [후기 DB](../../../../backend/contracts/review-summary-db.md) |
| 요약 표시 repository | `get_visible_review_summary` | 같은 후기 DB 계약 |
| jobs repository / worker | `enqueue_job`, `claim_job`, `complete_job`, `retry_job` | [작업 큐](../../../../backend/contracts/worker-jobs.md) |

회원 검색·요약 표시는 사용자 JWT, 내부 snapshot·게시·큐 처리는 service_role 경로다. 서비스 키로 회원 검색을 대신하면 익명 별칭이 반환된다. 서비스 키·lease token·후기 원문을 클라이언트/AI 탐색 도구에 전달하지 않는다.

RPC JSON에는 공통 HTTP envelope가 없다. HTTP 진입점에서 `{data,requestId}` / `{error,requestId}`를 만들고 SQLSTATE를 공개 오류로 변환한다. `22023`→`INVALID_REQUEST`, `P0002`→`RESOURCE_NOT_FOUND`, `28000`→`AUTH_REQUIRED`, `42501`→인증 문맥에 맞는 인증/권한 오류다. 요약 `40001`과 큐 `P0001/state_conflict`는 `STATE_CONFLICT`; 원문 SQL 오류와 detail은 반환하지 않는다. 요약 충돌이면 새 snapshot으로 다시 판단하며 오래된 출력을 무조건 재게시하지 않는다.

큐 kind는 `review_summary`만 지원한다. payload는 profileId/sourceRevision/modelVersion/promptVersion 네 문자열만 허용한다. snapshot의 sourceRevision은 불투명 정수 문자열, 버전 표식은 영문·숫자·점·밑줄·하이픈 1~64자다. queue lease는 필수 인수이고 운영 기본값·재시도 간격·최대 횟수는 아직 정하지 않았다.

요약은 공개 텍스트 후기 3개 이상과 전체 근거 ID 집합·현재 revision이 맞아야 게시된다. 중복 게시에는 최초 결과를 반환한다. 내용의 사실성·민감정보 제외는 종현의 output/evidence 검사가 맡는다. 이 SQL을 통과했다고 모델 출력이 안전하다는 뜻은 아니다.

## 실제 검증 결과

Supabase CLI 2.116.0 / PostgreSQL 17.6에서 기존 20개+신규 3개 재생 PASS. 역할 전환을 포함한 큐/검색/후기 SQL 3개 PASS. 별도 DB 연결의 중복 enqueue, SKIP LOCKED claim, 게시 후 비공개 변경, 비공개 변경 후 오래된 게시 거절 4개 PASS. fixture 잔존 0. HTTP 공통 Deno 타입 검사도 PASS. 실행법은 [로컬 도구 안내](../../../../tools/local/README.md).

## 민규 후속 연결과 보류

- 공고 생성/수정 서비스가 등록 장소·주소를 분리해 `set_post_search_location`을 호출해야 한다. 기존 exact_location은 자동 이행하지 않았고 이전 list_posts 경로는 유지된다.
- 비용·작성자 나이 범위·날짜 구간 등 확장 검색 조건은 아직 최소 DB RPC에 없다. 종현 어댑터가 미지원 조건을 조용히 무시하지 않도록 요청이 필요하다.
- `set_review_publication`은 상위 서비스용 내부 연결점이며 기존 후기의 기본값은 비공개다. 공개 전환 스케줄러·정책 서비스·변경 후 재요약 enqueue/outbox는 아직 연결하지 않았다.
- 수동 완료 양측 확인은 후기 적격성에서 검사하지만 기존 완료 RPC 자체는 아직 단측 완료 방식이다. 양측 완료 전환·알림 기록·분쟁 이후 기한 처리 보완은 민규 후속 작업이다.
- DB 클라이언트·인증 middleware·업무 handler·종현 워커와의 end-to-end 연결은 미완료다. PASS 공급사/세션, 계좌 효력 변경 후 확정, 분쟁 판단 세부 정책은 결정하지 않았다.

상대 파일 수정 대신 종현 요청 폴더에 계약 차이·필요 필터·어댑터 요구를 남기면 민규가 자기 영역에서 후속 구현한다.
