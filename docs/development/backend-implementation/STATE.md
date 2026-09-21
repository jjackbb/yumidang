# 구현 하네스 상태

자동 생성 파일이다. 직접 수정하지 말고 하네스를 실행한다. 상태 값: `pending`, `running`, `pass`, `fail`, `not_run`.

- 마지막 run: `release-profile-final2-20260917`
- 재개 지점: 모든 단계 pass — 회귀는 `npm run test:harness`

| 단계 | 상태 | run_id | 단계 결과 | 마지막 통과 단계 | 실패 원인 | 재실행 명령 |
|---|---|---|---|---|---|---|
| 사전 검사 | `pass` | release-profile-final2-20260917 | PASS 7 | local migrations are named with remote versions | - | `npm run harness:preflight` |
| 기능 1 회원가입 | `pass` | run-20260917T000709-1i5g | PASS 9 | logout revokes the refresh token | - | `npm run harness:01` |
| 기능 2 로그인 | `pass` | run-20260917T000709-1i5g | PASS 6 | refresh keeps the user; logout revokes only that session | - | `npm run harness:02` |
| 기능 3 공고 | `pass` | run-20260917T000709-1i5g | PASS 11 | direct REST writes to posts/private details are refused | - | `npm run harness:03` |
| 기능 4 상대 프로필 | `pass` | run-20260917T000709-1i5g | PASS 5 | A cannot read B raw profile directly; own raw birth date remains available to the owner | - | `npm run harness:04` |
| 기능 5 참여 요청 | `pass` | run-20260917T010006-4bgs | PASS 11 | direct REST insert/update on join_requests is refused | - | `npm run harness:05` |
| 기능 6 매칭 채팅 | `pass` | run-20260917T010426-3rio | PASS 10 | after the meetup start (server time) a pending chat is read-only | - | `npm run harness:06` |
| 기능 7 최종 확정 | `pass` | run-20260917T010447-23fj | PASS 10 | direct REST writes to appointments are refused | - | `npm run harness:07` |
| 기능 8 동행 완료 | `pass` | run-20260917T010017-ufzz | PASS 9 | completion responses carry no raw personal data | - | `npm run harness:08` |
| 기능 9 상호 평가 | `pass` | run-20260917T010103-74yq | PASS 10 | review responses contain no raw personal data or exact place | - | `npm run harness:09` |
| A/B/C 두 브라우저 전체 사이클 | `pass` | run-20260917T010522-ay26 | PASS 17 | no uncaught page errors in A/B/C/anon browsers | - | `npm run harness:full-cycle` |

증거는 `docs/development/backend-implementation/evidence/<run_id>/`에 run별로 저장되며 기존 파일을 덮어쓰지 않는다.
