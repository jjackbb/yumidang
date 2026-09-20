# 과거 프로토타입 자동화 도구

현재 기본 실행·검증은 루트 `package.json`의 `dev`, `test`, `build` 명령을 사용한다.

이 폴더의 세 스크립트는 완료된 overnight 프로토타입 작업용이다. 서로의 경로와 프로젝트 루트를 참조하므로 위치·코드를 보존했다. 자동 실행을 현재 작업 방식으로 재개하지 않는다.

| 파일 | 당시 용도 |
|---|---|
| `run-claude-overnight.py` | Claude 단계별 자동 실행·재시도 |
| `preview-checkpoints.py` | 검증된 미리보기 사본 저장 |
| `check-preview.cjs` | 미리보기 화면 최소 점검 |

특정 모델명과 개인 컴퓨터의 브라우저·도구 경로가 포함돼 있다. 재사용할 때는 현재 환경과 작업 범위를 확인한다. 기존 실행 맥락은 [과거 안내](../docs/overnight/START_HERE.md), 현재 작업은 [최신 인수인계](../HANDOFF.md)를 따른다.
