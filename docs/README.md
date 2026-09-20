# 문서 안내

현재 시작점은 루트 [HANDOFF.md](../HANDOFF.md)다. **파일의 마지막 ‘현재’ 문구보다 날짜와 실제 후속 결정이 우선**한다.

## 현재 작업

| 자료 | 용도 |
|---|---|
| [작업 분담](work-allocation/README.md) | 팀원 1 정책·팀원 2 API·사용자+GPT 화면 설계 |
| [화면 구조](design/SCREEN_INVENTORY.md) | 팀 합의용 전체 화면·흐름·상태 초안 |
| [디자인 기준](design/DESIGN.md), [Stitch 입력](design/STITCH_PROMPTS.md) | 시안 생성 기준 |
| [AI 기능 설계](design/AI_FEATURES_DESIGN.md) | 초안과 확정 D-A16 문구 구분 |
| [정책 자료](product-decisions/README.md) | 원문·확정 결정·미결 질문 |
| [현재 실행 안내](prompts/START_HERE.md) | 담당별 시작 문서 연결 |
| [최신 정리 기록](handoffs/REPOSITORY_CLEANUP_2026-09-20.md) | 정리 범위·검증·커밋/푸시 상태 |

## 구현·검증 참고

- `backend-plans/`: 기능별 계약과 구현 인수인계.
- `backend-implementation/`: 실행 절차·상태·원격 검증 증거. PASS는 해당 날짜·환경에 한정한다.
- `ut-improvements/`: 유저테스트 후 개선과 검증 기록.
- `fixes/`: 결함 수정·배포 증거.

## 과거 설계·프로토타입 기록

`analysis/`, `design-selection/`, `home-update/`, `overnight/`, `post-lifecycle/`, `profile-completion/`, `prototype-roadmap/`는 당시의 분석·선택·구현·증거를 보존한다. 오래된 실행 지시를 재개 지시로 사용하지 않는다. 테스트가 참조하거나 결과를 기록하는 경로가 있어 폴더를 일괄 이동하지 않았다.

- [완료 프롬프트](archive/completed-prompts/2026-09-17/README.md)
- [정리 전 루트 문서·생성 도구 메타데이터](archive/project-history/2026-09-20/README.md)

스크린샷·JSON 증거는 원본과 검사별 문맥을 보존한다. 설치·빌드 산출물처럼 재생성 가능한 파일과 구분한다.
