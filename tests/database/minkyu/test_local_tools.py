"""실제 DB 없이 임시 Git 저장소에서 로컬 준비 도구의 보존·거절 경계를 검사한다."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools/local" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migrations = load("prepare_migrations")
environment = load("check_environment")


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "repo"
        self.root.mkdir()
        self.sql = self.root / migrations.MIGRATIONS
        self.sql.mkdir(parents=True)
        self.git("init", "-q")
        self.first = self.sql / "20260916080335_first.sql"
        self.first.write_text("select 1;\n")
        self.git("add", ".")
        self.commit()

    def git(self, *args):
        # 사용자 Git 설정과 분리된 임시 검증용 저장소만 사용한다.
        env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        env.update({"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull})
        return subprocess.run(["git", "-C", str(self.root), *args], env=env,
                              capture_output=True, check=True, timeout=10)

    def commit(self):
        self.git("-c", "user.name=Local fixture", "-c", "user.email=fixture@example.invalid",
                 "commit", "-qm", "fixture")

    def add(self, name, content):
        (self.sql / name).write_text(content)
        self.git("add", ".")
        self.commit()

    def test_only_tracked_canonical_files_sorted_and_source_preserved(self):
        self.add("20260916080334_earlier.sql", "select 2;\n")
        self.add("20260916080335_first 2.sql", "select 1;\n")
        (self.sql / "20260916080335_first 3.sql").write_text("copy")
        (self.sql / "20260916080339_untracked.sql").write_text("select 9;")
        before = {path.name: path.read_bytes() for path in self.sql.iterdir()}
        report = migrations.prepare(self.root, self.base / "execution")
        self.assertEqual(report["count"], 2)
        self.assertEqual([row["version"] for row in report["migrations"]], ["20260916080334", "20260916080335"])
        self.assertEqual(len(report["excluded"]), 3)
        target = self.base / "execution/supabase/migrations"
        self.assertEqual({path.name for path in target.iterdir()}, {"20260916080334_earlier.sql", self.first.name})
        self.assertEqual(before, {path.name: path.read_bytes() for path in self.sql.iterdir()})
        self.assertEqual(json.loads((self.base / "execution/migration-manifest.json").read_text()), report)
        self.assertEqual(report["sql_execution"], "NOT_RUN")

    def test_default_dry_run_creates_nothing(self):
        before = set(self.base.iterdir())
        self.assertEqual(migrations.prepare(self.root)["count"], 1)
        self.assertEqual(set(self.base.iterdir()), before)

    def test_duplicate_version_rejected(self):
        self.add("20260916080335_second.sql", "select 2;")
        with self.assertRaisesRegex(migrations.PreparationError, "중복 버전"):
            migrations.prepare(self.root)

    def test_duplicate_contents_rejected(self):
        self.add("20260916080336_second.sql", self.first.read_text())
        with self.assertRaisesRegex(migrations.PreparationError, "동일 내용"):
            migrations.prepare(self.root)

    def test_unstaged_and_staged_modifications_rejected(self):
        self.first.write_text("select 77;")
        for stage in (False, True):
            with self.subTest(staged=stage):
                if stage:
                    self.git("add", ".")
                with self.assertRaisesRegex(migrations.PreparationError, "커밋 이력과 다른"):
                    migrations.prepare(self.root)

    def test_staged_new_sql_rejected(self):
        (self.sql / "20260916080336_new.sql").write_text("select 8;")
        self.git("add", ".")
        with self.assertRaisesRegex(migrations.PreparationError, "커밋 이력과 다른"):
            migrations.prepare(self.root)

    def test_staged_deletion_rejected(self):
        self.add("20260916080336_second.sql", "select 2;")
        self.git("rm", str(self.first.relative_to(self.root)))
        with self.assertRaisesRegex(migrations.PreparationError, "커밋 이력과 다른"):
            migrations.prepare(self.root)

    def test_assume_unchanged_does_not_hide_modified_sql(self):
        self.git("update-index", "--assume-unchanged", str(self.first.relative_to(self.root)))
        self.first.write_text("select 77;")
        with self.assertRaisesRegex(migrations.PreparationError, "커밋 이력과 다른"):
            migrations.prepare(self.root)

    def test_empty_history_rejected(self):
        self.git("rm", str(self.first.relative_to(self.root)))
        self.commit()
        with self.assertRaisesRegex(migrations.PreparationError, "이력이 없습니다"):
            migrations.prepare(self.root)

    def test_noncanonical_and_empty_sql_rejected(self):
        self.add("bad.sql", "select 8;")
        with self.assertRaisesRegex(migrations.PreparationError, "정식 SQL 파일명"):
            migrations.prepare(self.root)
        self.git("rm", str((self.sql / "bad.sql").relative_to(self.root)))
        self.first.write_text(" \n")
        self.git("add", ".")
        self.commit()
        with self.assertRaisesRegex(migrations.PreparationError, "빈 SQL"):
            migrations.prepare(self.root)

    def test_nonempty_output_rejected_without_changes(self):
        output = self.base / "execution"
        output.mkdir()
        marker = output / "keep.txt"
        marker.write_text("keep")
        with self.assertRaisesRegex(migrations.PreparationError, "비어 있지"):
            migrations.prepare(self.root, output)
        self.assertEqual(list(output.iterdir()), [marker])
        self.assertEqual(marker.read_text(), "keep")

    def test_empty_output_accepted(self):
        output = self.base / "empty"
        output.mkdir()
        migrations.prepare(self.root, output)
        self.assertTrue((output / "supabase/migrations" / self.first.name).is_file())

    def test_relative_repo_and_non_temporary_output_rejected(self):
        for output in (Path("relative"), self.root / "output", Path.home() / "foundation-output"):
            with self.subTest(output=str(output)), self.assertRaises(migrations.PreparationError):
                migrations.prepare(self.root, output)

    def test_symlink_output_and_sql_rejected(self):
        alias = self.base / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(migrations.PreparationError, "심볼릭"):
            migrations.prepare(self.root, alias / "output")
        self.first.unlink()
        self.first.symlink_to(self.base / "missing")
        with self.assertRaises(migrations.PreparationError):
            migrations.prepare(self.root)


class EnvironmentTests(unittest.TestCase):
    def test_missing_tool_never_runs_process(self):
        with patch.object(environment.shutil, "which", return_value=None), patch.object(environment.subprocess, "run") as run:
            self.assertEqual(environment.probe_tool("deno")["status"], "MISSING")
            run.assert_not_called()

    def test_version_only_output_and_timeout(self):
        result = subprocess.CompletedProcess([], 0, stdout="deno 2.5.0\nSECRET=not-output", stderr="TOKEN=not-output")
        with patch.object(environment.shutil, "which", return_value="/tool"), patch.object(environment.subprocess, "run", return_value=result) as run:
            report = environment.probe_tool("deno")
            self.assertEqual(report["version"], "2.5.0")
            self.assertNotIn("not-output", json.dumps(report))
            self.assertEqual(run.call_args.args[0], ["/tool", "--version"])
            self.assertEqual(run.call_args.kwargs["timeout"], 5)
        with patch.object(environment.shutil, "which", return_value="/tool"), patch.object(environment.subprocess, "run", side_effect=subprocess.TimeoutExpired("tool", 5)):
            self.assertEqual(environment.probe_tool("deno")["status"], "TIMEOUT")

    def test_config_skeleton_and_invalid_config_are_not_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "backend/supabase/config.toml"
            deno = root / "backend/supabase/functions/deno.json"
            deno.parent.mkdir(parents=True)
            config.write_text("# TODO\n")
            deno.write_text("{}")
            with patch.object(environment, "probe_tool", return_value={"status": "READY"}):
                report = environment.inspect_environment(root)
            self.assertEqual(report["status"], "NOT_READY")
            self.assertEqual(set(report["runtime_checks"].values()), {"NOT_RUN"})
            self.assertEqual(report["config"], {"supabase": "UNCONFIGURED", "deno": "UNCONFIGURED"})
            config.write_text("this is not toml")
            deno.write_text("[")
            self.assertEqual(environment.inspect_config(root), {"supabase": "INVALID", "deno": "INVALID"})


if __name__ == "__main__":
    unittest.main()
