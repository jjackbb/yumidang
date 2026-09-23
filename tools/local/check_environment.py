#!/usr/bin/env python3
"""로컬 도구·설정 준비 여부를 읽기 전용으로 보고한다. 실행환경 검증은 별도다."""

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import tomllib

TOOLS = ("python3", "node", "deno", "supabase", "docker")


def probe_tool(name):
    executable = shutil.which(name)
    if not executable:
        return {"status": "MISSING", "path": None, "version": None}
    try:
        result = subprocess.run([executable, "--version"], capture_output=True, text=True, timeout=5)
    except subprocess.TimeoutExpired:
        return {"status": "TIMEOUT", "path": executable, "version": None}
    except OSError:
        return {"status": "ERROR", "path": executable, "version": None}
    # 도구의 전체 stdout/stderr 및 환경 변수는 출력하지 않는다.
    match = re.search(r"(?<![\w.])v?(\d+\.\d+(?:\.\d+)?)(?![\w.])", result.stdout)
    return {"status": "READY" if result.returncode == 0 and match else "ERROR",
            "path": executable, "version": match.group(1) if match else None}


def inspect_config(root):
    config = root / "backend/supabase/config.toml"
    deno = root / "backend/supabase/functions/deno.json"
    result = {}
    try:
        data = tomllib.loads(config.read_text())
        required = ("project_id", "api", "db", "auth")
        present = (all(key in data for key in required)
                   and isinstance(data.get("project_id"), str) and bool(data["project_id"].strip())
                   and all(isinstance(data.get(key), dict) and bool(data[key]) for key in required[1:]))
        result["supabase"] = "PRESENT_UNVERIFIED" if present else "UNCONFIGURED"
    except FileNotFoundError:
        result["supabase"] = "MISSING"
    except (OSError, ValueError):
        result["supabase"] = "INVALID"
    try:
        data = json.loads(deno.read_text())
        tasks = data.get("tasks") if isinstance(data, dict) else None
        result["deno"] = "PRESENT_UNVERIFIED" if isinstance(tasks, dict) and tasks.get("check:common") else "UNCONFIGURED"
    except FileNotFoundError:
        result["deno"] = "MISSING"
    except (OSError, ValueError):
        result["deno"] = "INVALID"
    return result


def inspect_environment(root):
    tools = {name: probe_tool(name) for name in TOOLS}
    config = inspect_config(Path(root))
    ready = all(item["status"] == "READY" for item in tools.values()) and all(
        value == "PRESENT_UNVERIFIED" for value in config.values())
    return {"status": "READY" if ready else "NOT_READY", "tools": tools, "config": config,
            "runtime_checks": {"deno_typecheck": "NOT_RUN", "docker_daemon": "NOT_RUN",
                               "supabase_start": "NOT_RUN", "migration_replay": "NOT_RUN"},
            "note": "READY는 실행 전 도구·설정 존재 확인만 의미합니다. 설정 유효성·DB 실행 성공 판정이 아닙니다."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    report = inspect_environment(args.repo)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
