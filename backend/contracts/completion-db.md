# 완료 DB 연결 계약

구현: `20260923100000_bilateral_completion.sql`. 기존 이력·완료 행을 다시 쓰지 않는다.

## 사용자 호출

`confirm_appointment_completion(p_appointment_id uuid)`는 인증된 약속 당사자만 호출한다. 기존 table 응답 signature를 유지한다. 예상 종료 이후 자신의 확인을 한 번 기록하고 한 명만 확인한 경우 `status=confirmed`, `completed_at/completion_notified_at=NULL`이다. 두 명의 확인이 있으면 `completed`, `completion_method=manual`로 바뀐다. 마지막 확인자의 ID는 감사 정보이며 상대 확인을 대신 생성하지 않는다. 재요청은 기존 확인·완료 시각을 보존한다.

`get_appointment_state(p_appointment_id uuid)`는 기존 응답에 포함된 `my_completion_at`, `peer_completion_at`을 각각 제공한다. 이미 확인한 사람에게 `can_confirm_completion=false`이며 상대 확인 대기를 표시할 수 있다. 상대·시각·주소 권한은 기존 당사자 조회 계약을 유지한다.

익명은 `28000`, 외부 회원/없는 약속은 `PT404`, 종료 이전·취소·불발·분쟁은 `22023`이다. 원본 SQL 메시지는 공통 API가 공개 오류 코드로 변환한다.

## 내부 자동 완료

`process_due_completions(p_limit integer)`는 `service_role` 전용이며 범위는 1~1000이다. 응답은 `{completedCount, appointments:[{appointmentId,completedAt}]}`이다. `confirmed`이면서 예상 종료 +24시간이 지난 행만 `FOR UPDATE SKIP LOCKED`로 처리하며 열린 분쟁과 불발 판정도 제외한다. 자동 처리는 개인 수동 확인 기록을 만들지 않는다.

**사용자 확정:** 지연 실행도 실제 자동 완료 처리 시각을 `completed_at`으로 기록하고, 그 시각부터 7일 작성 기한을 계산한다. `completion_notified_at`도 동일 시각이며 24시간 공개 보류 기준이다. 외부 호출자가 기준 시각을 주입하지 못한다. 기존 cron이 호출하는 `private.complete_due_appointments`도 이 규칙으로 교체하며 기존 `p_at` 인수는 호환용으로만 받고 사용하지 않는다.

완료 전환과 두 당사자의 `appointment_completed` 알림은 동일 DB 트랜잭션이다. 고유 제약으로 중복 알림을 방지하고 알림 클릭은 완료를 실행하지 않는다. 앱에서 읽을 수 있는 알림 행 생성 시각이 기준이며 실제 클릭 시각은 사용하지 않는다. 기존 cron 주기는 이번 변경에서 새로 선택하지 않았다.

분쟁 판단·종결·수동 완료 후 누가 이의 신청 가능한지에 관한 기존 세부 제한은 이번 작업에서 임의 재정의하지 않는다. 기존 분쟁 RPC의 상세 정책 검토가 별도로 남는다.

## 검증

`tests/database/minkyu/bilateral_completion.sql`은 트랜잭션 롤백 fixture로 한 명/양측 확인, 재시도, 권한, 이른 시점/취소/분쟁 거절, 지연 자동 완료 시각, 알림 중복 방지, 실제 DB 역할을 검사한다. 실제 실행 결과는 민규 작업 현황에 기록한다.
