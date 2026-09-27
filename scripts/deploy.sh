#!/usr/bin/env bash
# Run local checks first. --dry-run (or SKIP_DEPLOY=1) never contacts Pi.
# Preprovision private/.env and data; deployment never creates/overwrites secrets.
set -euo pipefail
umask 077

PI_HOST=${PI_HOST:-ishanaracho@10.200.10.5}
PI_PATH=${PI_PATH:-/DATA/AppData/edu-nara}
PI_KEY=${PI_KEY:-/root/.ssh/id_ed25519}
PI_ENV_FILE=${PI_ENV_FILE:-$PI_PATH/private/.env}
RELEASE_ID=${RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}
dry=${SKIP_DEPLOY:-0}
if [[ ${1:-} == --dry-run && $# == 1 ]]; then dry=1
elif (( $# )); then printf 'Usage: %s [--dry-run]\n' "$0" >&2; exit 2; fi
[[ $dry == 0 || $dry == 1 ]] || { echo 'Invalid SKIP_DEPLOY' >&2; exit 2; }
# SSH invokes remote shell: accept only shell-safe target/path characters.
[[ $PI_HOST =~ ^[a-zA-Z0-9_][a-zA-Z0-9_-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$ &&
   $RELEASE_ID =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$ ]] || { echo 'Invalid host/release' >&2; exit 2; }
for path in "$PI_PATH" "$PI_KEY" "$PI_ENV_FILE"; do
  [[ $path =~ ^/[a-zA-Z0-9_./-]+$ && $path != *'/../'* && $path != */.. &&
     $path != *'/./'* && $path != */. && $path != *'//'* && $path != */ ]] || { echo 'Invalid absolute path' >&2; exit 2; }
done
[[ $PI_ENV_FILE != "$PI_PATH/releases/"* ]] || { echo 'Environment must live outside releases' >&2; exit 2; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
release=$PI_PATH/releases/$RELEASE_ID
manifest=$(mktemp)
remote=$(mktemp)
trap 'rm -f "$manifest" "$remote"' EXIT

# Include tracked and untracked source, never ignored files or runtime/secrets.
python3 - "$manifest" <<'PY'
import fnmatch, os, pathlib, subprocess, sys
files = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'])
excluded = {'.git', '.hermes', 'node_modules', '.pnpm-store', '.svelte-kit', 'build', 'dist',
            'data', 'private', 'secrets', '.ssh', 'logs', 'coverage', 'test-results',
            'playwright-report', '.playwright', '.cache', '.turbo', '.vite', '__pycache__'}
patterns = ('.env*', '.node_modules*', '*.db*', '*.sqlite*', '*.pem', '*.key', '*.p12', '*.pfx',
            '*.log', '*.pyc', '*credentials*', 'id_rsa*', 'id_ed25519*', '*password*', 'token*', '.netrc')
with open(sys.argv[1], 'wb') as out:
    for name in sorted(set(files.split(b'\0')) - {b''}):
        path = pathlib.Path(os.fsdecode(name))
        if any(part in excluded or any(fnmatch.fnmatch(part.lower(), p) for p in patterns) for part in path.parts):
            continue
        if path.is_symlink() or any(p.is_symlink() for p in path.parents):
            sys.exit('Refusing source symlink: ' + str(path))
        if path.name == '.npmrc':
            if str(path) != '.npmrc':
                continue
            if any(word in path.read_text().lower() for word in ('_auth', '_password', 'token', 'username')):
                sys.exit('Refusing credential-bearing .npmrc')
        if path.is_file():
            out.write(name + b'\0')

PY

cat > "$remote" <<'REMOTE'
set -euo pipefail
umask 077
base=$1; release=$2; envfile=$3; id=$4
[[ -f $envfile && ! -L $envfile && -r $envfile &&
   $(stat -c %u "$envfile") == "$(id -u)" &&
   $(stat -c %a "$envfile") =~ ^(400|600)$ ]] || { echo 'Environment must be owned by deployment user with mode 400/600, regular and readable' >&2; exit 1; }
# Serialize app deployment only; never stop other projects or touch tunnel.
[[ ! -L $base/.deploy.lock && ( ! -e $base/.deploy.lock || -f $base/.deploy.lock ) ]] || { echo 'Unsafe deployment lock' >&2; exit 1; }
exec 9>>"$base/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
test -d "$base/data" && test -w "$base/data"
test -d "$base/backups" && test -w "$base/backups"
[[ ! -e "$base/current" || -L "$base/current" ]] || { echo 'current must be a symlink' >&2; exit 1; }
previous=$(readlink -f "$base/current" || true)
cd "$release"
ln -s "$envfile" .env
export EDU_NARA_IMAGE="edu-nara:$id" EDU_NARA_DATA_DIR="$base/data" EDU_NARA_BACKUP_DIR="$base/backups" EDU_NARA_BIND_IP=10.200.10.5
compose=(docker compose --project-name edu-nara --env-file "$envfile" -f "$release/compose.yaml")
# Fail closed if Compose does not honor release image, persistent data or LAN bind.
"${compose[@]}" config --format json | python3 -c '
import json, os, sys
s = json.load(sys.stdin)["services"]["app"]
assert s["image"] == os.environ["EDU_NARA_IMAGE"], "Compose image variable mismatch"
v = s.get("volumes", [])
assert len(v) == 2, "Compose volume count mismatch"
expected_volumes = {
    ("/app/data", os.environ["EDU_NARA_DATA_DIR"]),
    ("/app/backups", os.environ["EDU_NARA_BACKUP_DIR"]),
}
assert {(item["target"], item["source"]) for item in v} == expected_volumes and all(item["type"] == "bind" for item in v), "Compose persistent volume mismatch"
p = s.get("ports", [])
assert len(p) == 1 and p[0].get("host_ip") == os.environ["EDU_NARA_BIND_IP"] and str(p[0]["published"]) == "3000" and p[0]["target"] == 3000, "Compose LAN bind mismatch"
assert s.get("healthcheck", {}).get("test") and not s["healthcheck"].get("disable"), "Healthcheck required"
'
printf 'Prior release retained: %s\n' "${previous:-none}"
printf 'Rollback: use prior release .env and image tag with docker compose --project-name edu-nara up -d --no-build --no-deps --wait app; repoint current only after healthy. Database rollback needs compatible schema or backup.\n'
"${compose[@]}" build app
if ! "${compose[@]}" up -d --no-build --no-deps --wait --wait-timeout 180 app; then
  echo 'Health gate failed; current unchanged. Running app may need rollback.' >&2
  exit 1
fi
container=$("${compose[@]}" ps -q app)
[[ -n $container && $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]]
curl --fail --silent --show-error --max-time 10 http://10.200.10.5:3000/health >/dev/null
ln -s "$release" "$base/.current-$id"
mv -Tf "$base/.current-$id" "$base/current"
printf 'Healthy release active: %s\n' "$release"
REMOTE

ssh_args=(-o BatchMode=yes -o IdentitiesOnly=yes -i "$PI_KEY")
prepare="umask 077; test -r '$PI_ENV_FILE' && test -f '$PI_ENV_FILE' && test -d '$PI_PATH/data' && mkdir -p '$PI_PATH/releases' && mkdir '$release' && test -w '$release'"
activate="bash -s -- '$PI_PATH' '$release' '$PI_ENV_FILE' '$RELEASE_ID'"
archive=(tar -czf - --no-recursion --null --verbatim-files-from -T "$manifest")
extract="umask 077; tar -xzf - --no-same-owner --no-same-permissions -C '$release'"
if [[ $dry == 1 ]]; then
  printf 'DRY RUN: no remote actions. Release: %s\n' "$release"
  printf 'ssh '; printf '%q ' "${ssh_args[@]}" "$PI_HOST" "$prepare"; printf '\n'
  printf '%q ' "${archive[@]}"; printf '| ssh '; printf '%q ' "${ssh_args[@]}" "$PI_HOST" "$extract"; printf '\nManifest:\n'
  python3 - "$manifest" <<'PY'
import pathlib, sys
for name in pathlib.Path(sys.argv[1]).read_bytes().split(b'\0'):
    if name: print(repr(name.decode('utf-8', 'surrogateescape')))
PY
  printf 'ssh '; printf '%q ' "${ssh_args[@]}" "$PI_HOST" "$activate"; printf '\nRemote health/activation script:\n'
  cat "$remote"
  exit 0
fi
for command in ssh tar python3 git; do command -v "$command" >/dev/null; done
test -r "$PI_KEY"
ssh "${ssh_args[@]}" "$PI_HOST" "$prepare"
"${archive[@]}" | ssh "${ssh_args[@]}" "$PI_HOST" "$extract"
ssh "${ssh_args[@]}" "$PI_HOST" "$activate" < "$remote"
