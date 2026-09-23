# 민규 서비스 API 런타임 계약

현재 구현은 `Request → 인증 → 입력 검증 → service → repository → 고정 RPC`로 연결된다. 시간·관계·동시성·상태 전이는 DB RPC가 결정하며 서비스 모듈은 같은 정책을 복제하지 않는다. 실제 로컬 Auth/JWT/DB 통합 결과는 [민규 현황](../../docs/collaboration/minkyu.md)에 별도로 기록한다.

## HTTP 및 인증

- Supabase 경로는 `/functions/v1/service-api`이며 직접 실행용 `/service-api`도 지원한다. 아래 표의 경로를 뒤에 붙인다. 임의 suffix, 인코딩 우회, 알 수 없는 경로는 404다.
- 현재 모든 사용자 경로는 `Authorization: Bearer <검증되는 사용자 access token>`을 요구한다. 비로그인 공개 검색은 종현의 검색 경로에서 연결한다. DB `get_service_post`의 비로그인 공개 반환 지원과 이 API의 사용자 인증 요구는 별개다.
- 내부 유지보수는 별도 내부 secret을 Bearer로 받는다. 사용자 JWT·서비스 역할 키 자체를 내부 비밀로 대신 사용하지 않는다. 사용자 경로가 실패해도 내부 클라이언트로 재시도하지 않는다.
- 허용된 정확한 Origin만 CORS 응답을 받는다. preflight 허용 헤더는 `authorization, content-type, apikey`다. apikey 자체는 사용자 인증이 아니다.
- POST는 `application/json`과 객체 본문을 사용한다. 인자가 없는 POST도 `{}`를 보낸다. 초과 필드·타입 불일치·중복 query는 400이다. 크기 한도는 `MAX_REQUEST_BYTES` 설정값이다.
- 성공은 `{data,requestId}`, 실패는 `{error:{code,message,retryable},requestId}`이며 동일 ID를 `X-Request-Id`에 넣는다. 사용자 요청 ID를 복사하지 않는다. `Cache-Control: no-store`가 적용된다.
- `data`는 각 고정 RPC 결과다. 기존 table-returning RPC는 snake_case 객체 배열, 신규 JSON RPC는 해당 DB 계약의 camelCase 객체다. 배열 첫 항목을 암묵적으로 꺼내거나 없는 결과를 성공 객체로 만들지 않는다.
- 인증 실패 401, 권한 거절 403, 대상 부재 404, 상태·조건 버전 충돌 409, 설정/외부 연결 누락 503이다. DB 오류 원문·토큰·SQL·채팅/후기 원문을 로그나 오류에 넣지 않는다.

## 사용자 경로

`id`는 UUID다. 목록에 표시한 경우에만 `?limit=1..100&before=<UUID>`를 허용한다. 생략 시 limit20은 페이지 크기이며 서비스 운영 시간 정책이 아니다.

| 메서드·경로 | 입력 및 고정 RPC |
|---|---|
| GET `/me` | `get_my_profile()`; 본인 필드만 |
| POST `/me/avatar` | `{avatarPath}` → `set_my_profile_avatar`; `<user UUID>/<image UUID>.jpg` 경로, 실제 Storage 객체 소유권·MIME·크기는 DB 확인 |
| GET `/appointments` | `list_my_appointments()` |
| GET `/appointments/:id` | `get_appointment_state(p_appointment_id)` |
| POST `/appointments/:id/confirm-completion` | `{}` → `confirm_appointment_completion`; 한쪽 확인은 완료 전 유지 |
| GET `/appointments/:id/reviews` | `get_appointment_review_state` |
| POST `/appointments/:id/reviews` | 아래 후기 입력 → 5인자 `submit_appointment_review` |
| GET `/profiles/:id/reviews` | 페이지 query → `get_public_profile_reviews`; 공개 원문·칭찬 집계 |
| GET `/notifications` | 페이지 query → `list_my_notifications` |
| POST `/notifications/:id/read` | `{}` → `mark_my_notification_read`; 동의·완료를 실행하지 않음 |
| POST `/notifications/read-all` | `{}` → `mark_all_my_notifications_read` |
| GET `/conversations` | `list_conversations()` |
| GET `/conversations/:id` | 신청 ID → `get_conversation` |
| GET `/conversations/:id/messages` | 페이지 query → `list_conversation_messages` |
| POST `/conversations/:id/messages` | `{messageId,content}` → `send_conversation_message`; content1..1000자, 같은 재시도 ID 유지 |
| POST `/posts` | 아래 무료 공고 입력 → `create_service_post` |
| GET `/posts/:id` | `get_service_post`; 마스킹과 확정 당사자의 비공개 필드 구분은 DB 검사 |
| POST `/posts/:id/requests` | `{message}` 10..300자 → `request_service_post`; 지원되는 무료 공고에만 신청 |
| GET `/requests/sent` | `list_sent_join_requests()` |
| GET `/requests/received` | `list_received_join_requests()` |
| GET `/requests/:id/consent` | `get_match_consent`; 참여자가 현재 조건·버전 확인 |
| POST `/requests/:id/withdraw` | `{}` → `withdraw_join_request` |
| POST `/requests/:id/decline` | `{}` → `decline_join_request` |
| POST `/requests/:id/propose` | `{}` → 작성자 `propose_match`; 약속을 즉시 확정하지 않음 |
| POST `/requests/:id/accept` | `{conditionVersion}` → 신청자 `accept_match`; 조회한 동일 버전 필요 |

후기 입력:

```json
{"rating":5,"experience":"positive","comment":"편안하게 대화했어요","praises":[]}
```

rating은 정수1..5, experience는 `positive|neutral|negative`, comment는 선택/null 또는1..300자다. praises는 최대3개이며 positive에만 허용한다. 실제 칭찬 목록이 아직 확정되지 않아 DB는 현재 비어 있지 않은 praises를 거절한다. 별점을 당도로 환산하지 않는다. 후기 제출 성공을 공개 완료로 표현하지 않는다.

공고 입력 예시(가상):

```json
{
  "postId":"11111111-1111-4111-8111-111111111111",
  "title":"무료 전시 동행",
  "description":"함께 전시를 관람해요",
  "category":"전시",
  "startsAt":"2099-01-01T10:00:00+09:00",
  "endsAt":"2099-01-01T12:00:00+09:00",
  "recruitmentEndsAt":"2099-01-01T09:00:00+09:00",
  "publicArea":"서울특별시 성동구 성수동",
  "registeredPlaceName":null,
  "registeredAddress":"가상 등록 주소",
  "meetingDetail":"가상 만남 상세",
  "preferenceNote":null,
  "tags":[],
  "costType":"free",
  "amount":0
}
```

제목2..80자, 소개1..2000자, 공개지역 최대60자, 장소명 최대200자, 등록주소1..300자, 만남상세2..200자, 선택 선호문구 최대300자, 태그 최대5개·각20자다. 문자열은 앞뒤 공백을 허용하지 않는다. 시간은 offset 또는 Z가 있는 ISO 문자열이며 종료가 시작보다 늦고 모집 종료가 시작 이하여야 한다. 현재 지역 형식은 기존 DB 제약을 따르며 임의로 바꾸지 않는다.

유료 `paid_request|paid_offer`는 503이며 공급사 연결 없이 성공 처리하지 않는다. 신규 무료 공고와 달리 비용 미상인 기존 공고는 `request_service_post`에서 차단된다. 클라이언트 `authorId`, `userId`, 권한·성별·확정 상태 필드는 허용하지 않는다. PASS 가입, 공고 수정·삭제, 은행 확인, 분쟁 판정, 당도 산식 경로는 미정 사항을 임의 결정해 추가하지 않았다.

## 내부 유지보수

`POST /internal/maintenance` 본문은 `{ "limit": 20 }`이며 정수1..100이다. `REVIEW_SUMMARY_MODEL_VERSION`, `REVIEW_SUMMARY_PROMPT_VERSION`은 서버 설정으로만 받는다. 모델 공급사를 선택하거나 실행하는 API가 아니다.

1. 내부 호출자 검증 및 모든 입력·설정 확인.
2. `process_due_completions(p_limit)` 호출.
3. `process_review_automation(p_limit,p_model_version,p_prompt_version)` 호출.
4. `{completion: <RPC 결과>, reviews: <RPC 결과>}` 반환.

두 RPC는 각각 트랜잭션이며 전체 HTTP 요청이 하나의 DB 트랜잭션은 아니다. 2번 후 3번이 실패하면 앞 단계 완료 처리는 유지되고 HTTP는 실패를 반환한다. 재호출은 DB의 조건·중복 방지를 따른다. 자동 완료 시각과 7일 기한은 사용자가 확정한 **실제 처리 시각**을 기준으로 DB에서 계산한다.

이 경로는 호출 가능한 실행 진입점이다. 종현 소유 `scheduled-jobs`의 배포·예약 등록은 변경하지 않았으며 자동 주기 실행이 이미 연결됐다는 뜻이 아니다. 요약 생성 모델과 작업 소비자는 종현의 후속 연결이 필요하다.

## 검증

- `node --test tests/functions/minkyu/service_api.test.ts`: handler·서비스·repository 단위 검사22개 PASS. 실제 Web API, 인증 실패·권한 경로 분리·엄격한 입력·RPC 매핑·민감정보 제외를 검증한다.
- `deno check --no-remote backend/supabase/functions/service-api/index.ts`: 런타임 전체 모듈 타입 검사 PASS.
- mock 검사를 실제 JWT/SQL 검증으로 표현하지 않는다. 실제 통합 검증 증거는 총괄의 [민규 현황](../../docs/collaboration/minkyu.md)에 기록한다.


## 실행 진입점과 검증 범위

`index.ts`는 `createRuntimeHandler(read)`와 lazy `default { fetch }`를 제공한다. 실제 설정·인증·DB 조립은 factory 한 곳에 있으며, 모듈 import 시 환경을 읽거나 서버를 시작하지 않는다. 호스팅 런타임은 default fetch를 사용할 수 있고 직접 Deno 실행은 `import.meta.main`에서 같은 fetch를 `Deno.serve`에 등록한다. 이는 현재 [Supabase 공식 시작 안내](https://supabase.com/docs/guides/functions/quickstart)의 default fetch 형태를 따른다.

`verify_jwt=false`는 이 함수가 사용자 JWT와 별도 내부 작업 secret을 경로별로 직접 검증하기 위한 설정이다. 사용자 인증 검사를 생략한다는 뜻이 아니다. [공식 함수 설정](https://supabase.com/docs/guides/functions/function-configuration)

Node import 검사와 Deno 타입 검사, standalone Deno handler·로컬 Supabase의 실제 HTTP/JWT/DB 통합 결과를 관리형 Edge hosting 결과와 구분한다. **관리형 Edge hosting 및 원격 배포는 NOT_RUN**이며 default export 추가만으로 배포 준비가 검증됐다고 설명하지 않는다.
