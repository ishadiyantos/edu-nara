"""Offline deployment checks: python3 -m unittest discover -s tests/deploy -v."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/deploy.sh"


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "scripts").mkdir()
        shutil.copy2(SCRIPT, self.root / "scripts/deploy.sh")
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        for name in ("ssh", "rsync"):
            path = self.bin / name
            path.write_text('#!/bin/sh\necho "NETWORK_FORBIDDEN" >&2\nexit 99\n')
            path.chmod(0o755)

    def run_script(self, *args, **env):
        return subprocess.run(
            ["bash", str(self.root / "scripts/deploy.sh"), *args],
            cwd="/", text=True, capture_output=True,
            env={**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}",
                 "RELEASE_ID": "20260926T010203Z-test", **env},
        )

    def test_dry_run_uses_isolated_release_without_network(self):
        (self.root / "source.txt").write_text("source")
        result = self.run_script("--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("/DATA/AppData/edu-nara/releases/20260926T010203Z-test", result.stdout)
        self.assertIn("/root/.ssh/id_ed25519", result.stdout)
        self.assertIn("source.txt", result.stdout)
        self.assertNotIn("NETWORK_FORBIDDEN", result.stderr)
        self.assertNotIn("--delete", result.stdout)
        self.assertIn("tar -czf - --no-recursion --null --verbatim-files-from", result.stdout)
        self.assertNotIn("rsync", result.stdout.split("Manifest:\n", 1)[0])
        self.assertIn("tar\\ -xzf", result.stdout)

    def test_manifest_excludes_tracked_secrets_runtime_and_generated_files(self):
        allowed = ["src/new.ts", "src/tracked.ts", "file with spaces.txt"]
        blocked = [".env", ".env.example", "private/settings.txt", "data/db.sqlite",
                   "nested/.env.production", "keys/server.pem", "node_modules/pkg/a.js",
                   "build/index.js", "test-results/out.txt", "secrets/admin.txt",
                   ".node_modules-phase0-backup/pkg/a.js", "nested/.node_modules-old/a.js",
                   "nested/id_ed25519", "nested/token.json", "nested/password.txt",
                   "nested/credentials.json", "nested/.npmrc"]
        for name in allowed + blocked:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("DO_NOT_PRINT_FILE_CONTENT")
        subprocess.run(["git", "-C", str(self.root), "add", "src/tracked.ts", *blocked], check=True)
        result = self.run_script("--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = result.stdout.split("Manifest:\n", 1)[1].split("\nssh ", 1)[0]
        for name in allowed:
            self.assertIn(repr(name), manifest)
        for name in blocked:
            self.assertNotIn(repr(name), manifest)
        self.assertNotIn("DO_NOT_PRINT_FILE_CONTENT", result.stdout + result.stderr)

    def test_skip_deploy_is_offline(self):
        result = self.run_script(SKIP_DEPLOY="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("DRY RUN", result.stdout)

    def test_rejects_shell_injection_and_relative_paths(self):
        for env in ({"PI_HOST": "user@host;id"}, {"PI_PATH": "/tmp/app;id"},
                    {"PI_PATH": "/tmp/../app"}, {"PI_PATH": "relative"},
                    {"PI_KEY": "/tmp/key with spaces"}, {"RELEASE_ID": "../old"},
                    {"PI_ENV_FILE": "/DATA/AppData/edu-nara/releases/new/.env"},
                    {"SKIP_DEPLOY": "maybe"}):
            with self.subTest(env=env):
                result = self.run_script("--dry-run", **env) if "SKIP_DEPLOY" not in env else self.run_script(**env)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("NETWORK_FORBIDDEN", result.stderr)

    def test_rejects_source_symlinks(self):
        (self.root / "source.txt").symlink_to("/etc/passwd")
        result = self.run_script("--dry-run")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Refusing source symlink", result.stderr)

    def test_remote_rejects_insecure_env_and_symlink_lock(self):
        remote = self.run_script("--dry-run").stdout.split("Remote health/activation script:\n", 1)[1]
        base = self.root / "deployment"
        base.mkdir()
        (base / "data").mkdir()
        (base / "backups").mkdir()
        envfile = base / ".env"
        envfile.write_text("TEST_ONLY=1\n")
        envfile.chmod(0o644)
        args = ["bash", "-s", "--", str(base), str(base / "missing-release"), str(envfile), "test"]
        result = subprocess.run(args, input=remote, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Environment must be owned", result.stderr)
        envfile.chmod(0o600)
        lock = base / ".deploy.lock"
        if lock.exists():
            lock.unlink()
        lock.symlink_to(envfile)
        result = subprocess.run(args, input=remote, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unsafe deployment lock", result.stderr)
        self.assertEqual(envfile.read_text(), "TEST_ONLY=1\n")

    def test_remote_health_failure_preserves_current_then_success_promotes(self):
        remote = self.run_script("--dry-run").stdout.split("Remote health/activation script:\n", 1)[1]
        base = self.root / "deployment"
        release = base / "releases" / "test"
        release.mkdir(parents=True)
        old = base / "releases" / "old"
        old.mkdir()
        (base / "data").mkdir()
        (base / "backups").mkdir()
        (base / "current").symlink_to(old)
        envfile = base / ".env"
        envfile.write_text("TEST_ONLY=1\n")
        envfile.chmod(0o600)
        docker = self.bin / "docker"
        docker.write_text('''#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
if 'config' in args:
    print(json.dumps({'services': {'app': {
        'image': os.environ['EDU_NARA_IMAGE'],
        'volumes': [
            {'type': 'bind', 'source': os.environ['EDU_NARA_DATA_DIR'], 'target': '/app/data'},
            {'type': 'bind', 'source': os.environ['EDU_NARA_BACKUP_DIR'], 'target': '/app/backups'},
        ],
        'ports': [{'host_ip': '10.200.10.5', 'published': '3000', 'target': 3000}],
        'healthcheck': {'test': ['CMD', 'true']}}}}))
elif 'up' in args:
    sys.exit(int(os.environ.get('FAIL_HEALTH', '0')))
elif 'ps' in args:
    print('test-container')
elif 'inspect' in args:
    print('healthy')
''')
        docker.chmod(0o755)
        curl = self.bin / "curl"
        curl.write_text('#!/bin/sh\nexit 0\n')
        curl.chmod(0o755)
        args = ["bash", "-s", "--", str(base), str(release), str(envfile), "test"]
        env = {**os.environ, "PATH": f"{self.bin}:{os.environ['PATH']}", "FAIL_HEALTH": "1"}
        failed = subprocess.run(args, input=remote, text=True, capture_output=True, env=env)
        self.assertNotEqual(failed.returncode, 0)
        self.assertIn("Health gate failed", failed.stderr)
        self.assertEqual((base / "current").resolve(), old)
        self.assertTrue(old.exists())
        (release / ".env").unlink()
        success = subprocess.run(args, input=remote, text=True, capture_output=True,
                                 env={**env, "FAIL_HEALTH": "0"})
        self.assertEqual(success.returncode, 0, success.stderr)
        self.assertEqual((base / "current").resolve(), release)
        self.assertEqual((base / ".deploy.lock").stat().st_mode & 0o777, 0o600)
        self.assertTrue(old.exists())

    def test_remote_gate_orders_activation_after_health(self):
        result = self.run_script("--dry-run")
        remote = result.stdout.split("Remote health/activation script:\n", 1)[1]
        syntax = subprocess.run(["bash", "-n"], input=remote, text=True, capture_output=True)
        self.assertEqual(syntax.returncode, 0, syntax.stderr)
        self.assertIn("--project-name edu-nara", remote)
        self.assertIn("EDU_NARA_DATA_DIR=\"$base/data\"", remote)
        self.assertIn("--no-deps --wait", remote)
        self.assertLess(remote.index("--wait --wait-timeout"), remote.index('mv -Tf'))
        self.assertLess(remote.index("http://10.200.10.5:3000/health"), remote.index('mv -Tf'))
        self.assertNotIn("docker compose down", remote)
        self.assertNotIn("--remove-orphans", remote)


if __name__ == "__main__":
    unittest.main()
