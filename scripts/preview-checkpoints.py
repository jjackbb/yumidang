#!/usr/bin/env python3
"""Keep independently built, smoke-checked previews while Claude continues editing."""
import argparse
import datetime as dt
import fcntl
import hashlib
import html
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / ".overnight"
BASE = RUN / "previews"
RELEASES = BASE / "releases"
PORT = 4188
ORIGIN = f"http://127.0.0.1:{PORT}"
STAGES = ["공통 상태·데모", "가입·프로필", "탐색·공고·Me", "관심친구·알림", "완료·평가·안전", "체험·통합검증"]

def read_json(path, default=None):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {} if default is None else default

def save_json(path, value):
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temp.replace(path)

def now():
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")

def inputs():
    files = []
    for folder in ["src", "public", "tests"]:
        files.extend(p for p in (ROOT / folder).rglob("*") if p.is_file() and not p.is_symlink())
    for pattern in ["package*.json", "tsconfig*.json", "vite.config.*", "index.html"]:
        files.extend(ROOT.glob(pattern))
    return sorted(set(p for p in files if p.is_file() and not p.is_symlink()))

def fingerprint():
    digest = hashlib.sha256()
    for p in inputs():
        digest.update(str(p.relative_to(ROOT)).encode())
        digest.update(p.read_bytes())
    return digest.hexdigest()

def run_check(command, cwd, logfile, env=None, timeout=600):
    with logfile.open("w") as output:
        rc = subprocess.call(command, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=timeout)
    if rc:
        raise RuntimeError(f"{logfile.name}: exit {rc}")

def capture(reason="automatic"):
    BASE.mkdir(parents=True, exist_ok=True)
    RELEASES.mkdir(parents=True, exist_ok=True)
    lock = (BASE / "capture.lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return False
    state = read_json(RUN / "state.json")
    previous = read_json(BASE / "latest.json")
    digest = fingerprint()
    passed = [int(i) for i, value in state.get("steps", {}).items() if value.get("status") == "PASS"]
    if previous.get("source_hash") == digest:
        previous.update(completed_stages=passed, runner_status_at_check=state.get("status"))
        save_json(BASE / "latest.json", previous)
        return True
    release_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + digest[:8]
    work = BASE / "work" / release_id
    logs = BASE / "checks" / release_id
    work.mkdir(parents=True)
    logs.mkdir(parents=True)
    save_json(BASE / "capture-state.json", {"status": "CHECKING", "at": now(), "reason": reason})
    try:
        for p in inputs():
            target = work / p.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, target)
        if fingerprint() != digest:
            raise RuntimeError("Source changed during copy; keep previous preview and retry later.")
        (work / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        run_check(["npm", "run", "lint"], work, logs / "lint.log")
        run_check(["npm", "test"], work, logs / "unit.log")
        run_check(["npm", "run", "build", "--", "--base", f"/releases/{release_id}/"], work, logs / "build.log")
        release = RELEASES / release_id
        shutil.copytree(work / "dist", release)
        url = f"{ORIGIN}/releases/{release_id}/?demo=1"
        env = os.environ.copy()
        env.update(CHECK_URL=url, EVIDENCE_DIR=str(logs))
        run_check(["node", str(ROOT / "scripts/check-preview.cjs")], ROOT, logs / "browser.log", env)
        smoke = read_json(logs / "preview-smoke.json")
        if smoke.get("status") != "PASS":
            raise RuntimeError("Browser smoke check did not pass.")
        info = {
            "created_at": now(), "url": url, "release_id": release_id,
            "source_hash": digest, "completed_stages": passed,
            "in_progress_stage": state.get("current_step"),
            "runner_status_at_check": state.get("status"),
            "checks": ["TypeScript PASS", "unit tests PASS", "build PASS", "mobile/desktop smoke PASS"],
            "validation_scope": "페이지 열기·데모 역할 전환·Me/탐색 이동·새로고침 검사. 전체 기능 완성 판정과 다름.",
            "evidence": str(logs.relative_to(ROOT)), "reason": reason
        }
        save_json(BASE / f"{release_id}.json", info)
        save_json(BASE / "latest.json", info)
        save_json(BASE / "capture-state.json", {"status": "READY", "at": now(), "url": url})
        (ROOT / "docs/overnight/PREVIEW.md").write_text(
            "# 확인 가능한 중간 결과\n\n"
            f"항상 열 수 있는 안내: {ORIGIN}\n\n"
            f"현재 보존한 빌드: {url}\n\n"
            f"빌드 시각: {info['created_at']}\n\n"
            f"실행기 완료 단계: {', '.join(map(str, passed)) or '없음'}\n\n"
            "타입·단위·빌드 및 모바일/데스크톱 열림 검사를 통과한 사본입니다. "
            "진행 중 단계의 일부 화면도 포함될 수 있으며, 전체 기능 완료를 뜻하지 않습니다.\n\n"
            "이후 검사 실패·Claude 한도 대기·중단 시에도 이 사본을 유지합니다. "
            "개발 화면의 편집과 별개이며 해당 빌드 주소는 바뀌지 않습니다.\n")
        print(f"{now()} READY {url}", flush=True)
        return True
    except Exception as error:
        save_json(BASE / "capture-state.json", {"status": "KEPT_PREVIOUS", "at": now(), "reason": str(error), "logs": str(logs.relative_to(ROOT))})
        print(f"{now()} KEPT_PREVIOUS {error}", flush=True)
        return False

def payload():
    state = read_json(RUN / "state.json")
    return {
        "runner": {key: state.get(key) for key in ["status", "detail", "current_step", "retry_at", "updated_at"]},
        "steps": {key: {"status": value.get("status")} for key, value in state.get("steps", {}).items()},
        "preview": read_json(BASE / "latest.json"), "capture": read_json(BASE / "capture-state.json")
    }

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE), **kwargs)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/status.json":
            body = json.dumps(payload(), ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/":
            data = payload()
            preview = data["preview"]
            esc = lambda value: html.escape(str(value or ""))
            rows = "".join(f"<tr><td>{i}. {esc(name)}</td><td>{esc(data['steps'].get(str(i),{}).get('status','PENDING'))}</td></tr>" for i,name in enumerate(STAGES,1))
            link = f'<a class="open" href="{esc(preview["url"])}">확인된 중간 결과 열기 →</a>' if preview else "<p>첫 중간 빌드를 검사 중입니다. 확인되면 이곳에 열기 버튼이 나타납니다.</p>"
            body = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30"><title>유미당 작업 미리보기</title>
<style>body{{font:16px/1.6 system-ui,sans-serif;color:#20202a;background:#f5f3f9;margin:0;padding:32px 20px}}main{{max-width:740px;margin:auto;background:white;border-radius:20px;padding:28px}}h1{{font-size:25px;margin-top:0}}.open{{display:block;padding:15px;border-radius:12px;background:#6c2cf5;color:white;text-decoration:none;font-weight:700;margin:20px 0}}table{{width:100%;border-collapse:collapse;font-size:14px}}td{{padding:10px 0;border-bottom:1px solid #eee}}small{{color:#666}}.note{{background:#fff6db;padding:14px;border-radius:10px}}</style>
<main><h1>유미당 작업 미리보기</h1><p>Claude 진행 상태: <b>{esc(data['runner'].get('status'))}</b><br>{esc(data['runner'].get('detail'))}</p>
{link}<p class="note">아래 완료 단계와 진행 중 단계를 구분해 확인해 주세요. 중간 빌드는 타입·단위·빌드·화면 열림 검사를 통과한 사본이며, 진행 중 기능의 일부도 포함될 수 있습니다.</p>
<p><small>중간 빌드 저장: {esc(preview.get('created_at','검사 중'))}<br>다음 재시도: {esc(data['runner'].get('retry_at','해당 없음'))}</small></p>
<table><tbody>{rows}</tbody></table><p>작업이 멈춰도 저장한 중간 결과는 유지됩니다. 이 안내 화면은 30초마다 갱신됩니다.</p><small>전체 기능 검증과 실제 인증·결제·통화·운영 연동은 별도입니다.</small></main></html>""".encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if not path.startswith("/releases/") or not (BASE / path.lstrip("/")).resolve().is_relative_to(RELEASES.resolve()):
            self.send_error(404)
            return
        super().do_GET()
    def log_message(self, format, *args):
        pass

def watch():
    previous_trigger = None
    attempted = None
    while True:
        state = read_json(RUN / "state.json")
        passed = tuple(key for key, value in state.get("steps", {}).items() if value.get("status") == "PASS")
        trigger = (passed, state.get("status"), state.get("current_step"), state.get("retry_at"))
        latest = read_json(BASE / "latest.json")
        if not latest or trigger != previous_trigger:
            candidate = (trigger, fingerprint())
            if candidate != attempted:
                attempted = candidate
                if capture("runner state changed"):
                    previous_trigger = trigger
        time.sleep(30)

def main():
    BASE.mkdir(parents=True, exist_ok=True)
    lock = (BASE / "server.lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("Preview server already running.")
        return
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    (BASE / "server.pid").write_text(str(os.getpid()))
    threading.Thread(target=watch, daemon=True).start()
    print(f"{now()} SERVER {ORIGIN}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--detach", action="store_true")
    parser.add_argument("--capture", action="store_true")
    args = parser.parse_args()
    BASE.mkdir(parents=True, exist_ok=True)
    if args.detach:
        with (BASE / "server.log").open("a") as log:
            proc = subprocess.Popen([sys.executable, str(Path(__file__).resolve())], cwd=ROOT, stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        print(json.dumps({"pid": proc.pid, "url": ORIGIN}))
    elif args.capture:
        sys.exit(0 if capture("stage checkpoint") else 1)
    else:
        main()
