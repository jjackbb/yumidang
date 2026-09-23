"""하네스의 단독 수정 범위를 검증한다. 실제 파일·Git 설정은 수정하지 않는다."""

import copy
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/collaboration"))
import check_harness as harness
import check_ownership as ownership


class HarnessTests(unittest.TestCase):
    def setUp(self):
        self.policy = ownership.validate_policy({
            "version": 1,
            "protected_paths": ["backend/", "docs/", "tools/"],
            "rules": [
                {"path": "backend/", "owner": "minkyu"},
                {"path": "backend/ai/", "owner": "jonghyun"},
                {"path": "docs/", "owner": "minkyu"},
                {"path": "tools/", "owner": "minkyu"},
            ],
        })
        self.manifest = {
            "version": 1, "actor": "minkyu", "baseline": "baseline", "branch": "branch",
            "lanes": {"coordinator": ["docs/status.md"], "A": ["backend/http.ts"],
                      "B": ["backend/contracts.md"], "C": ["tools/local.py"]},
        }

    def test_same_actor_cannot_edit_another_lane(self):
        files = harness.validate_manifest(self.manifest, self.policy)
        self.assertEqual(harness.check_paths(files, "A", ["backend/http.ts"]), [])
        self.assertEqual(harness.check_paths(files, "A", ["backend/contracts.md"]), ["backend/contracts.md"])

    def test_unknown_file_is_denied(self):
        files = harness.validate_manifest(self.manifest, self.policy)
        self.assertEqual(harness.check_paths(files, "A", ["backend/extra.ts"]), ["backend/extra.ts"])

    def test_overlapping_lanes_fail_before_execution(self):
        self.manifest["lanes"]["B"].append("backend/http.ts")
        with self.assertRaisesRegex(ownership.CheckError, "중복"):
            harness.validate_manifest(self.manifest, self.policy)

    def test_other_owner_cannot_be_added_to_manifest(self):
        self.manifest["lanes"]["A"] = ["backend/ai/agent.ts"]
        with self.assertRaisesRegex(ownership.CheckError, "민규 담당"):
            harness.validate_manifest(self.manifest, self.policy)

    def test_unprotected_directory_glob_and_parent_paths_are_rejected(self):
        for path in ["outside/file.ts", "backend/", "backend/*.ts", "../backend/a.ts"]:
            with self.subTest(path=path):
                data = copy.deepcopy(self.manifest)
                data["lanes"]["A"] = [path]
                with self.assertRaises(ownership.CheckError):
                    harness.validate_manifest(data, self.policy)

    def test_previous_phase_bytes_cannot_be_changed_or_claimed(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            (repo / 'backend').mkdir()
            source = repo / 'backend/previous.ts'
            source.write_text('previous phase')
            self.manifest['version'] = 2
            self.manifest['preserved'] = {'backend/previous.ts': hashlib.sha256(source.read_bytes()).hexdigest()}
            files = harness.validate_manifest(self.manifest, self.policy)
            harness.validate_preserved(self.manifest, files, repo, self.policy)
            with self.assertRaisesRegex(ownership.CheckError, '충돌'):
                harness.validate_preserved(self.manifest, {**files, 'backend/previous.ts': 'A'}, repo, self.policy)
            source.write_text('changed')
            with self.assertRaisesRegex(ownership.CheckError, '이전 단계'):
                harness.validate_preserved(self.manifest, files, repo, self.policy)


if __name__ == "__main__":
    unittest.main()
