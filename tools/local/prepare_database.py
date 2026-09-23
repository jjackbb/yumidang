#!/usr/bin/env python3
"""기존 Git 이력 + 2·3차의 명시적 SQL 6개를 격리된 임시 폴더에 준비. 실행 없음."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from prepare_migrations import PreparationError, prepare

PENDING = (
    "20260923090000_worker_jobs.sql",
    "20260923091000_public_post_search.sql",
    "20260923092000_review_summary_storage.sql",
    "20260923100000_bilateral_completion.sql",
    "20260923101000_review_automation.sql",
    "20260923102000_core_service_api.sql",
)


def prepare_database(repo, output):
    repo = Path(repo).resolve()
    payloads = []
    for name in PENDING:
        path = repo / "backend/supabase/migrations" / name
        if path.is_symlink() or not path.is_file() or not path.read_bytes().strip():
            raise PreparationError(f"검토할 신규 SQL이 없습니다: {name}")
        payloads.append(path.read_bytes())
    config = repo / "backend/supabase/config.toml"
    if config.is_symlink() or not config.is_file():
        raise PreparationError("로컬 설정이 없습니다.")
    config_bytes = config.read_bytes()
    report = prepare(repo, output)
    target = Path(report["output_root"])
    versions = {entry["version"] for entry in report["migrations"]}
    for name, data in zip(PENDING, payloads):
        if name[:14] in versions:
            raise PreparationError(f"이미 기준 이력에 들어간 SQL입니다. 다음 단계 범위를 다시 정의하세요: {name}")
        with (target / "supabase/migrations" / name).open("xb") as stream:
            stream.write(data)
    with (target / "supabase/config.toml").open("xb") as stream:
        stream.write(config_bytes)
    report["pending"] = [{"path": name, "sha256": hashlib.sha256(data).hexdigest()}
                         for name, data in zip(PENDING, payloads)]
    report["config_sha256"] = hashlib.sha256(config_bytes).hexdigest()
    report["total_count"] = report["count"] + len(payloads)
    with (target / "database-manifest.json").open("x") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare_database(args.repo, args.output), ensure_ascii=False, indent=2))
        return 0
    except (OSError, PreparationError) as exc:
        print(json.dumps({"status": "BLOCKED", "sql_execution": "NOT_RUN", "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
