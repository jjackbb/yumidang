"""실제 Docker를 호출하지 않고 원격·다른 프로젝트 거절과 준비 경계를 검증."""
import copy
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/local'))
import run_database_tests as runner
import prepare_database as preparation


class RuntimeBoundaryTests(unittest.TestCase):
    def test_only_dedicated_local_running_container_is_allowed(self):
        endpoint = 'unix://' + str(Path.home() / '.colima/yumidang-minkyu/docker.sock')
        container = {'Config': {'Labels': {'com.supabase.cli.project': runner.PROJECT}}, 'State': {'Running': True}}
        runner.validate_target(endpoint, container)
        for other in ['tcp://remote:2376', 'unix:///var/run/docker.sock', 'ssh://remote']:
            with self.assertRaises(ValueError):
                runner.validate_target(other, container)
        for change in ['wrong_project', 'stopped']:
            altered = copy.deepcopy(container)
            if change == 'wrong_project':
                altered['Config']['Labels']['com.supabase.cli.project'] = 'another-project'
            else:
                altered['State']['Running'] = False
            with self.assertRaises(ValueError):
                runner.validate_target(endpoint, altered)

    def test_pending_is_explicit_not_all_untracked_sql(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp) / 'repo'
            migrations = repo / 'backend/supabase/migrations'
            migrations.mkdir(parents=True)
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            (migrations / '20260101000000_baseline.sql').write_text('select 1;')
            subprocess.run(['git', '-C', str(repo), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(repo), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture'], check=True)
            (repo / 'backend/supabase/config.toml').write_text('project_id="fixture"')
            for i, name in enumerate(preparation.PENDING):
                (migrations / name).write_text(f'select {i+2};')
            (migrations / '20260101000000_baseline 2.sql').write_text('do not run')
            (migrations / '20990101000000_unreviewed.sql').write_text('do not run')
            output = Path(temp) / 'output'
            report = preparation.prepare_database(repo, output)
            names = {p.name for p in (output / 'supabase/migrations').iterdir()}
            self.assertEqual(names, {'20260101000000_baseline.sql', *preparation.PENDING})
            self.assertEqual(report['sql_execution'], 'NOT_RUN')
            self.assertEqual(report['total_count'], 1 + len(preparation.PENDING))
            with self.assertRaises(preparation.PreparationError):
                preparation.prepare_database(repo, output)
            (migrations / preparation.PENDING[0]).unlink()
            (migrations / preparation.PENDING[0]).symlink_to(migrations / preparation.PENDING[1])
            with self.assertRaises(preparation.PreparationError):
                preparation.prepare_database(repo, Path(temp) / 'second')


if __name__ == '__main__':
    unittest.main()
