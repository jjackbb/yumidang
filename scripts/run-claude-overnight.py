#!/usr/bin/env python3
"""Run the approved yumidang frontend tasks sequentially with Claude Opus 5."""
from __future__ import annotations
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tarfile
import time
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/overnight"
RUN = ROOT / ".overnight"
MODEL = "claude-opus-5"
CLAUDE = "/Users/b/.local/bin/claude"
PLAYWRIGHT = "/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright"
CHROME = "/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"
STAGES = ["공통 상태·데모", "가입·프로필", "탐색·공고·Me", "관심친구·알림", "완료·평가·안전", "체험·통합검증"]
ALLOWED = [
    "Read", "Edit", "Write", "Glob", "Grep",
    "Bash(npm run lint)", "Bash(npm test)", "Bash(npm run build)",
    "Bash(node tests/*)", "Bash(node --experimental-strip-types --test tests/*)",
    "Bash(git diff *)", "Bash(git status *)", "Bash(rg *)", "Bash(cat *)",
    "Bash(sed *)", "Bash(ls *)", "Bash(wc *)"
]
children: list[subprocess.Popen] = []
deadline = 0.0
state: dict = {}

def stamp():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="seconds")

def retry_delay(message, now=None):
    """Use the provider's daily reset time, with a one minute safety margin."""
    now = now or dt.datetime.now(dt.timezone.utc)
    match = re.search(r"\bresets?(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b(?:\s*\(([^)]+)\))?", message, re.I)
    if not match:
        return 600
    hour, minute = int(match[1]), int(match[2] or 0)
    if not 1 <= hour <= 12 or not 0 <= minute <= 59:
        return 600
    try:
        zone = ZoneInfo(match[4] or "Asia/Seoul")
    except (KeyError, ValueError):
        return 600
    local = now.astimezone(zone)
    hour = hour % 12 + (12 if match[3].lower() == "pm" else 0)
    reset = local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if reset <= local:
        if (local - reset).total_seconds() < 120:
            return 60
        reset += dt.timedelta(days=1)
    return max(60, int((reset - local).total_seconds()) + 60)

def wait_until_retry(seconds, step):
    target = min(time.monotonic() + seconds, deadline)
    wake = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))) + dt.timedelta(seconds=max(0, target-time.monotonic()))
    state["retry_at"] = wake.isoformat(timespec="seconds")
    state["steps"][str(step)]["status"] = "WAITING"
    publish("WAITING", f"단계 {step}: 세션 한도/일시 장애. {state['retry_at']}에 재시도", step)
    while time.monotonic() < target:
        time.sleep(min(45, max(0, target-time.monotonic())))
        state["updated_at"] = stamp()
        save_json(RUN / "state.json", state)

def save_json(path, data):
    temp = Path(str(path) + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temp.replace(path)

def publish(status, detail, step=None):
    state.update(status=status, detail=detail, updated_at=stamp(), pid=os.getpid(), model=MODEL)
    if step is not None:
        state["current_step"] = step
    save_json(RUN / "state.json", state)
    lines = ["# 자동 실행 상태", "", f"- 상태: **{status}**", f"- 갱신: {stamp()}",
             f"- 모델: {MODEL}", f"- 실행기 PID: {os.getpid()}", f"- 진행: {detail}",
             "- 확인된 중간 결과: http://127.0.0.1:4188 (작업 중단 시에도 마지막 사본 유지)",
             "- 개발 확인: http://127.0.0.1:4186/?demo=1",
             "- 통합검사 후 빌드 확인: http://127.0.0.1:4187/?demo=1", "",
             "| 단계 | 작업 | 상태 |", "| --- | --- | --- |"]
    for i, name in enumerate(STAGES, 1):
        info = state.get("steps", {}).get(str(i), {})
        lines.append(f"| {i} | {name} | {info.get('status', 'PENDING')} |")
    lines += ["", "검사 로그/세션: .overnight/ · Claude 상세 기록: [PROGRESS.md](PROGRESS.md)",
              "완성 안내: [MORNING_REPORT.md](MORNING_REPORT.md)", "",
              "COMPLETE는 로컬 프론트·브라우저 검사 통과를 뜻합니다. 실제 외부 연동·사용자 검증·게시 성공을 뜻하지 않습니다."]
    (DOC / "STATUS.md").write_text("\n".join(lines) + "\n")
    print(f"{stamp()} {status}: {detail}", flush=True)

def terminate(proc):
    if proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
            proc.wait(timeout=10)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

def handle_stop(signum, frame):
    for child in children:
        terminate(child)
    current = str(state.get("current_step", ""))
    if current in state.get("steps", {}):
        state["steps"][current]["status"] = "STOPPED"
    publish("STOPPED", "사용자/시스템 종료 신호. 재실행하면 검증 완료 단계 뒤에서 재개합니다.")
    raise SystemExit(128 + signum)

def run_logged(command, path, prompt=None, timeout=3600, check_url=None):
    env = os.environ.copy()
    env.update(PLAYWRIGHT_MODULE=PLAYWRIGHT, BROWSER_EXECUTABLE=CHROME,
               CHECK_URL=check_url or "http://127.0.0.1:4186/?demo=1",
               EVIDENCE_DIR=str(DOC / "evidence"))
    with path.open("w") as output:
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdout=output,
                                stderr=subprocess.STDOUT,
                                stdin=subprocess.PIPE if prompt is not None else subprocess.DEVNULL,
                                text=True, start_new_session=True)
        children.append(proc)
        state["active_child_pid"] = proc.pid
        save_json(RUN / "state.json", state)
        if prompt is not None:
            try:
                proc.stdin.write(prompt)
                proc.stdin.close()
            except BrokenPipeError:
                pass
        start = time.monotonic()
        last_heartbeat = start
        while proc.poll() is None:
            if time.monotonic() > deadline or time.monotonic() - start > timeout:
                terminate(proc)
                return 124
            if time.monotonic() - last_heartbeat > 45:
                state["updated_at"] = stamp()
                save_json(RUN / "state.json", state)
                last_heartbeat = time.monotonic()
            time.sleep(1)
        return proc.returncode

def read_result(path):
    result = None
    for line in path.read_text(errors="replace").splitlines():
        try:
            event = json.loads(line)
            if event.get("type") == "result":
                result = event
        except (json.JSONDecodeError, AttributeError):
            continue
    return result

def start_server(port, preview=False):
    path = RUN / ("preview.log" if preview else "dev.log")
    info_path = RUN / ("preview.json" if preview else "dev.json")
    if info_path.exists():
        try:
            old_pid = int(json.loads(info_path.read_text())["pid"])
            args = subprocess.check_output(["ps", "-p", str(old_pid), "-o", "command="], text=True).strip()
            if str(ROOT / "node_modules/vite/bin/vite.js") in args and f"--port {port}" in args:
                return None  # Reuse this runner's surviving server on resume.
        except (ValueError, KeyError, OSError, subprocess.CalledProcessError):
            pass
    command = ["node", str(ROOT / "node_modules/vite/bin/vite.js")]
    if preview:
        command.append("preview")
    command += ["--host", "127.0.0.1", "--port", str(port), "--strictPort"]
    log = path.open("a")
    proc = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL,
                            stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    log.close()
    children.append(proc)
    time.sleep(2)
    if proc.poll() is not None:
        raise RuntimeError(f"Port {port} server could not start; see {path}")
    save_json(RUN / ("preview.json" if preview else "dev.json"), {"pid": proc.pid, "port": port})
    return proc

def backup():
    dest = RUN / "baseline.tar.gz"
    if dest.exists():
        return
    paths = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT).decode().split("\0")
    with tarfile.open(dest, "w:gz") as archive:
        for name in sorted(set(paths)):
            if not name or name.startswith((".overnight/", ".git/", ".env", ".vercel/")):
                continue
            path = ROOT / name
            if path.is_file() and not path.is_symlink():
                archive.add(path, arcname=name, recursive=False)
    (RUN / "baseline-status.txt").write_text(subprocess.check_output(["git", "status", "--short"], cwd=ROOT).decode())
    (RUN / "baseline-head.txt").write_text(subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode())

def verify_browser():
    path = DOC / "evidence/browser.json"
    try:
        result = json.loads(path.read_text())
        cases = {c["id"]: c for c in result["cases"]}
        missing = [f"B{i:02}" for i in range(1, 16) if cases.get(f"B{i:02}", {}).get("status") != "PASS"]
        if missing or result.get("errors"):
            return False, "Browser cases failed/missing: " + ", ".join(missing)
        if len(list((DOC / "evidence").glob("*.png"))) < 8:
            return False, "Fewer than 8 actual browser screenshots"
        return True, "B01–B15 PASS and screenshots present"
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return False, f"Missing/invalid browser evidence: {exc}"

def main():
    global state, deadline
    RUN.mkdir(mode=0o700, exist_ok=True)
    DOC.mkdir(parents=True, exist_ok=True)
    lock = (RUN / "lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("An overnight runner is already active.", flush=True)
        return 2
    (RUN / "runner.pid").write_text(str(os.getpid()) + "\n")
    if (RUN / "state.json").exists():
        state = json.loads((RUN / "state.json").read_text())
    else:
        state = {"started_at": stamp(), "steps": {}}
    deadline = time.monotonic() + 8 * 3600
    state["resumed_at"] = stamp()
    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)
    backup()
    caffeinate = subprocess.Popen(["/usr/bin/caffeinate", "-i", "-t", "28800"], start_new_session=True,
                                 stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    children.append(caffeinate)
    state["caffeinate_pid"] = caffeinate.pid
    start_server(4186)
    preview_helper = ROOT / "scripts/preview-checkpoints.py"
    if preview_helper.exists():
        subprocess.run([sys.executable, str(preview_helper), "--detach"], cwd=ROOT, timeout=10, check=False)
    tasks = (DOC / "TASKS.md").read_text()
    for step in range(1, 7):
        if state["steps"].get(str(step), {}).get("status") == "PASS":
            continue
        stage = re.search(rf"<!-- STEP:{step} -->(.*?)<!-- ENDSTEP -->", tasks, re.S).group(1)
        attempt = 0
        feedback = "중단 전의 부분 구현을 먼저 검사하고 이어서 진행하세요. 이미 구현된 파일을 다시 만들거나 되돌리지 마세요."
        while attempt < 5 and time.monotonic() < deadline:
            attempt += 1
            state["steps"][str(step)] = {**state["steps"].get(str(step), {}), "status": "RUNNING", "attempt": attempt}
            state.pop("retry_at", None)
            state["call_sequence"] = state.get("call_sequence", 0) + 1
            publish("RUNNING", f"{step}/6 {STAGES[step-1]} · 시도 {attempt}", step)
            checkpoint = RUN / f"step-{step}.json"
            if checkpoint.exists():
                checkpoint.unlink()
            log = RUN / f"step-{step}-attempt-{attempt}-call-{state['call_sequence']}.jsonl"
            prompt = f"""사용자가 승인한 유미당 프론트 프로토타입 구현을 실행하세요. 모델은 Claude Opus 5 고정입니다.
먼저 docs/overnight/START_HERE.md, SPEC.md, TASKS.md, CHECKS.md, PROGRESS.md를 읽으세요.
이번 호출은 단계 {step}/6만 담당합니다. 이후 단계는 실행기가 자동 호출하므로 여기서 중단했다고 전체를 보류하지 마세요.
이번 단계:
{stage}

실제 구현을 완료하고 관련 검사 후 PROGRESS.md에 결과를 추가하세요.
권한 거부가 나면 허용된 Read/Edit/Write로 처리하고 검사는 npm run lint, npm test, npm run build, node tests/... 명령을 사용하세요.
다른 에이전트/모델을 호출하지 마세요. 외부 API/계정/노션/운영DB/배포/전역설정은 변경하지 마세요.
기존 사용자 파일 보존. .overnight의 로그·백업·state.json·실행기는 변경 금지; step-{step}.json만 이 단계 결과로 작성할 수 있습니다.
미정 제품정책은 SPEC의 보류 방식으로 앞단을 구현하고 확정 범위를 끝내세요. 사용자에게 질문하고 기다리는 대신 정해진 보류를 적용하세요.
코드 결과 없이 완료를 선언하지 마세요. SPEC/CHECKS를 약화하거나 검사삭제로 통과시키지 마세요.
마지막에 .overnight/step-{step}.json을 TASKS의 형식으로 쓰세요.
검사 환경은 CHECK_URL, PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE, EVIDENCE_DIR에 주어져 있습니다.
현재 개발서버는 http://127.0.0.1:4186/?demo=1 입니다. 서버를 새로 시작할 필요 없습니다.
이전 시도 결과:
{feedback}
"""
            command = [CLAUDE, "-p", "--model", MODEL, "--effort", "high",
                       "--safe-mode", "--restricted", "--strict-mcp-config",
                       "--tools", "Read,Write,Edit,Glob,Grep,Bash",
                       "--permission-mode", "acceptEdits", "--permission-prompts", "none",
                       "--allowedTools", *ALLOWED,
                       "--output-format", "stream-json", "--verbose"]
            rc = run_logged(command, log, prompt, timeout=5400)
            result = read_result(log)
            compact = {"exit_code": rc, "result": result.get("result") if result else None,
                       "session_id": result.get("session_id") if result else None,
                       "modelUsage": result.get("modelUsage") if result else None,
                       "permission_denials": result.get("permission_denials") if result else None}
            save_json(log.with_suffix(".result.json"), compact)
            state["steps"][str(step)]["last_result"] = str(log.relative_to(ROOT))
            raw = (compact.get("result") or "") + "\n" + log.read_text(errors="replace")[-4000:]
            if result and result.get("modelUsage") and MODEL not in result["modelUsage"]:
                raise RuntimeError("Expected Claude Opus 5 was not used; no model fallback authorized.")
            if rc != 0 or not result or result.get("is_error"):
                feedback = f"Claude invocation failed (exit {rc}). Inspect {log.relative_to(ROOT)}.\n" + raw[-2500:]
                if re.search(r"rate.?limit|usage.?limit|session.?limit|\bresets?\s|overloaded|429|529", raw, re.I):
                    attempt -= 1
                    wait_until_retry(retry_delay(compact.get("result") or raw), step)
                continue
            try:
                done = json.loads(checkpoint.read_text())
                completed = done.get("done") is True and done.get("step") == step
            except (OSError, ValueError):
                completed = False
            failures = []
            for label, command in [("lint", ["npm", "run", "lint"]), ("unit", ["npm", "test"])]:
                if run_logged(command, RUN / f"step-{step}-{label}.log", timeout=600) != 0:
                    failures.append(f"{label}: .overnight/step-{step}-{label}.log")
            if step == 6 and not failures:
                if run_logged(["npm", "run", "build"], RUN / "final-build.log", timeout=600) != 0:
                    failures.append("build: .overnight/final-build.log")
                else:
                    start_server(4187, preview=True)
                browser = ROOT / "tests/browser/overnight.cjs"
                if not browser.exists():
                    failures.append("tests/browser/overnight.cjs missing")
                else:
                    evidence = DOC / "evidence/browser.json"
                    if evidence.exists():
                        evidence.unlink()
                    if run_logged(["node", str(browser)], RUN / "final-browser.log", timeout=1200,
                                  check_url="http://127.0.0.1:4187/?demo=1") != 0:
                        failures.append("browser: .overnight/final-browser.log")
                    ok, why = verify_browser()
                    if not ok:
                        failures.append(why)
                if "아직 완성 전" in (DOC / "MORNING_REPORT.md").read_text():
                    failures.append("MORNING_REPORT.md still a placeholder")
            if not completed:
                failures.append(f"Write truthful .overnight/step-{step}.json after completing this stage.")
            if failures:
                feedback = "The independent runner checks failed; fix implementation without weakening criteria:\n" + "\n".join(failures)
                state["steps"][str(step)]["status"] = "REPAIRING"
                publish("REPAIRING", f"단계 {step} 검사 실패, Claude 수정 재실행", step)
                continue
            state["steps"][str(step)] = {"status": "PASS", "finished_at": stamp(), "attempts": attempt,
                                          "session_id": result.get("session_id"), "summary": done.get("summary")}
            publish("RUNNING", f"{step}/6 단계 검사 통과", step)
            if preview_helper.exists():
                # Failure to create a newer preview never deletes the last good one.
                try:
                    subprocess.run([sys.executable, str(preview_helper), "--capture"], cwd=ROOT, timeout=1200, check=False)
                except subprocess.TimeoutExpired:
                    print("Preview capture timed out; previous preview retained.", flush=True)
            break
        if state["steps"].get(str(step), {}).get("status") != "PASS":
            state["steps"][str(step)]["status"] = "BLOCKED"
            publish("BLOCKED", f"단계 {step} 완료 불가. 로그·부분 결과 보존. 시간/계정/실패 원인을 확인하세요.", step)
            with (DOC / "MORNING_REPORT.md").open("a") as report:
                report.write("\n\n## 실행기 확인\n전체 완료 아님. 단계 " + str(step) + "에서 중단. .overnight 로그와 STATUS.md 참조.\n")
            return 1
    publish("COMPLETE", "6단계·타입·단위·빌드·브라우저 검사 통과. 아침 보고서와 빌드 미리보기 확인.")
    with (DOC / "MORNING_REPORT.md").open("a") as report:
        report.write("\n\n## 실행기 확인\n" + stamp() + " — 6단계, 타입·단위·빌드·브라우저 실제 실행 통과.\n")
        report.write("빌드 미리보기: http://127.0.0.1:4187/?demo=1\n외부 게시·실사용자 검증은 이 판정에 포함되지 않습니다.\n")
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--detach", action="store_true")
    args = parser.parse_args()
    owner_path = DOC / "EXECUTION_OWNER.json"
    if owner_path.exists():
        owner = json.loads(owner_path.read_text()).get("owner")
        if owner != "claude":
            sys.exit("Claude 실행 중지: 현재 구현 담당은 GPT입니다. docs/overnight/GPT_HANDOFF.md를 확인하세요.")
    RUN.mkdir(mode=0o700, exist_ok=True)
    if args.detach:
        with (RUN / "runner.log").open("a") as output:
            proc = subprocess.Popen([sys.executable, str(Path(__file__).resolve())], cwd=ROOT,
                                    stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                                    start_new_session=True)
        print(json.dumps({"runner_pid": proc.pid, "log": str(RUN / "runner.log")}))
    else:
        try:
            sys.exit(main())
        except Exception as exc:
            publish("BLOCKED", f"실행기 오류: {type(exc).__name__}: {exc}")
            raise
