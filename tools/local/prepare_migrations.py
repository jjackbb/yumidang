#!/usr/bin/env python3
"""정식 Git 이력만 검사하고 선택적으로 임시 실행 루트에 복사한다. SQL 실행 없음."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

MIGRATIONS = Path("backend/supabase/migrations")
CANONICAL = re.compile(r"^(\d{14})_[A-Za-z0-9_]+\.sql$")
COPY = re.compile(r" \d+\.sql$")


class PreparationError(ValueError):
    pass


def git(root, *args):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, timeout=15, check=True
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise PreparationError("Git 이력을 확인하지 못했습니다.") from exc
    return result.stdout


def inspect_migrations(root):
    root = Path(root).resolve()
    actual = Path(git(root, "rev-parse", "--show-toplevel").decode().strip()).resolve()
    if actual != root:
        raise PreparationError("--repo는 저장소 최상위 경로여야 합니다.")
    changed = git(root, "diff", "HEAD", "--name-only", "-z", "--", str(MIGRATIONS))
    for name in filter(None, changed.decode().split("\0")):
        if Path(name).suffix == ".sql" and not COPY.search(Path(name).name):
            raise PreparationError(f"커밋 이력과 다른 SQL입니다: {name}")
    tracked = git(root, "ls-files", "-z", "--", str(MIGRATIONS)).decode().split("\0")
    entries, excluded, versions, hashes = [], [], set(), set()
    for name in sorted(filter(None, tracked)):
        path = Path(name)
        if path.suffix != ".sql":
            continue
        if COPY.search(path.name):
            excluded.append(name)
            continue
        match = CANONICAL.fullmatch(path.name)
        if path.parent != MIGRATIONS or not match:
            raise PreparationError(f"정식 SQL 파일명이 아닙니다: {name}")
        source = root / path
        if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(root):
            raise PreparationError(f"일반 SQL 파일이 아닙니다: {name}")
        data = source.read_bytes()
        if data != git(root, "show", f"HEAD:{name}"):
            raise PreparationError(f"커밋 이력과 다른 SQL입니다: {name}")
        if not data.strip():
            raise PreparationError(f"빈 SQL입니다: {name}")
        digest = hashlib.sha256(data).hexdigest()
        version = match.group(1)
        if version in versions:
            raise PreparationError(f"중복 버전입니다: {version}")
        if digest in hashes:
            raise PreparationError(f"동일 내용 SQL이 중복됩니다: {name}")
        versions.add(version)
        hashes.add(digest)
        entries.append({"version": version, "path": name, "sha256": digest, "bytes": len(data)})
    if not entries:
        raise PreparationError("Git에 등록된 정식 SQL 이력이 없습니다.")
    untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z", "--", str(MIGRATIONS))
    excluded.extend(filter(None, untracked.decode().split("\0")))
    return {"status": "READY", "sql_execution": "NOT_RUN", "migrations": entries,
            "excluded": sorted(excluded), "count": len(entries)}


def prepare(root, output=None):
    root = Path(root).resolve()
    report = inspect_migrations(root)
    if output is None:
        return report
    destination = Path(output)
    if not destination.is_absolute():
        raise PreparationError("--output은 임시 폴더 아래 절대 경로여야 합니다.")
    if any(part.is_symlink() for part in (destination, *destination.parents)
           if part != Path('/var') and part != Path('/tmp')):
        raise PreparationError("출력 경로에 심볼릭 링크를 사용할 수 없습니다.")
    destination = destination.resolve()
    temporary_root = Path(tempfile.gettempdir()).resolve()
    if destination == temporary_root or not destination.is_relative_to(temporary_root):
        raise PreparationError("--output은 시스템 임시 폴더의 하위 경로여야 합니다.")
    if destination.is_relative_to(root) or root.is_relative_to(destination):
        raise PreparationError("저장소와 겹치는 출력 경로는 허용하지 않습니다.")
    if destination.exists() and (not destination.is_dir() or any(destination.iterdir())):
        raise PreparationError("출력 루트가 비어 있지 않습니다. 기존 파일은 덮어쓰지 않습니다.")
    # 복사 전에 읽은 바이트를 보관하므로 이후 원본 변경이 복사 내용에 섞이지 않는다.
    payloads = []
    for entry in report["migrations"]:
        data = (root / entry["path"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise PreparationError("검사 중 SQL이 변경되었습니다. 다시 검사하십시오.")
        payloads.append(data)
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / "supabase" / "migrations"
    target.parent.mkdir()  # 기존 디렉터리와 충돌하면 실패한다.
    target.mkdir()
    for entry, data in zip(report["migrations"], payloads):
        with (target / Path(entry["path"]).name).open("xb") as stream:
            stream.write(data)
    report["output_root"] = str(destination)
    with (destination / "migration-manifest.json").open("x") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, help="비어 있는 임시 실행 루트의 절대 경로")
    args = parser.parse_args()
    try:
        report = prepare(args.repo, args.output)
    except (PreparationError, OSError) as exc:
        print(json.dumps({"status": "BLOCKED", "error": str(exc), "sql_execution": "NOT_RUN"}, ensure_ascii=False))
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
