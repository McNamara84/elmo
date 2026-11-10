#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
temp_parent="${TMPDIR:-/tmp}"
test_root="$(mktemp -d "$temp_parent/elmo-scan-test.XXXXXX")"
cleanup() {
  if [[ "$test_root" == "$temp_parent"/elmo-scan-test.* ]]; then
    rm -rf -- "$test_root"
  fi
}
trap cleanup EXIT
mkdir -p "$test_root/bin" "$test_root/cache"
printf 'test image archive\n' > "$test_root/image.tar"
image_id="sha256:$(printf 'a%.0s' {1..64})"

# No daemon, registry or real vulnerabilities are needed to exercise failures.
cat > "$test_root/bin/docker" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail
report_dir=''
operation=''
output=''
blocking=false
exit_code=0
while (( $# )); do
  case "$1" in
    --mount)
      if [[ "$2" == *,target=/scan ]]; then
        report_dir="${2#type=bind,source=}"
        report_dir="${report_dir%,target=/scan}"
      fi
      shift 2 ;;
    image|convert) operation="$1"; shift ;;
    --output) output="$2"; shift 2 ;;
    --exit-code) exit_code="$2"; shift 2 ;;
    --ignore-unfixed) blocking=true; shift ;;
    *) shift ;;
  esac
done
[[ -n "$report_dir" && -n "$output" ]]
output="$report_dir/${output##*/}"
if [[ "$operation" == convert ]]; then
  if [[ "$MOCK_MODE" != missing-text ]]; then
    printf 'Full vulnerability report, including unfixed findings.\n' > "$output"
  fi
  exit 0
fi
if [[ "$MOCK_MODE" == scanner-error ]]; then exit 42; fi
if [[ "$MOCK_MODE" == missing-report || ( "$MOCK_MODE" == missing-blocking && "$blocking" == true ) ]]; then exit 0; fi
if [[ "$MOCK_MODE" == malformed-report ]]; then printf '{' > "$output"; exit 0; fi

node --input-type=module - "$output" "$MOCK_MODE" "$MOCK_IMAGE_ID" "$blocking" <<'JS'
import { writeFileSync } from 'node:fs';
const [file, mode, imageId, blocking] = process.argv.slice(2);
const findings = [];
if (mode.startsWith('fixed-') || (mode === 'unfixed' && blocking === 'false')) {
  findings.push({ VulnerabilityID: 'CVE-TEST', PkgName: 'test-package', InstalledVersion: '1',
    Severity: mode === 'fixed-critical' ? 'CRITICAL' : 'HIGH', FixedVersion: mode === 'unfixed' ? '' : '2' });
}
const report = { SchemaVersion: 2, ArtifactType: 'container_image',
  Metadata: { ImageID: mode === 'wrong-image' ? `sha256:${'b'.repeat(64)}` : imageId, OS: { Family: 'debian' } },
  Results: [{ Class: 'os-pkgs', Packages: mode === 'no-packages' ? [] : [{ Name: 'libc6', Version: '2.41' }], Vulnerabilities: findings }] };
writeFileSync(file, JSON.stringify(report));
JS
if [[ "$MOCK_MODE" == blocking-error && "$blocking" == true ]]; then exit 43; fi
if [[ "$MOCK_MODE" == fixed-* || ( "$MOCK_MODE" == unfixed && "$blocking" == false ) ]]; then
  exit "$exit_code"
fi
BASH
chmod +x "$test_root/bin/docker"

run_case() {
  local mode="$1" expected="$2" status=0
  if PATH="$test_root/bin:$PATH" TRIVY_CACHE_DIR="$test_root/cache" \
      MOCK_MODE="$mode" MOCK_IMAGE_ID="$image_id" \
      bash "$repo_root/scripts/ci/scan-container-image.sh" \
      "$test_root/image.tar" "$image_id" "$test_root/$mode" > "$test_root/$mode.log" 2>&1; then
    status=0
  else
    status=$?
  fi
  if [[ "$status" != "$expected" ]]; then
    cat "$test_root/$mode.log" >&2
    echo "$mode: expected exit $expected, got $status" >&2
    exit 1
  fi
  echo "PASS $mode (exit $status)"
}

run_case clean 0
run_case unfixed 0
run_case fixed-high 1
run_case fixed-critical 1
run_case scanner-error 42
run_case blocking-error 43
run_case missing-report 1
run_case missing-blocking 1
run_case malformed-report 1
run_case wrong-image 1
run_case no-packages 1
run_case missing-text 1

# A valid old report must not turn a subsequent missing-output scan green.
mkdir -p "$test_root/missing-report/scan.stale"
cp "$test_root/clean"/scan.*/all.json "$test_root/missing-report/scan.stale/all.json"
run_case missing-report 1

node --input-type=module - "$test_root/unfixed" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = process.argv[2];
const directory = `${root}/${readdirSync(root)[0]}`;
const all = JSON.parse(readFileSync(`${directory}/all.json`, 'utf8'));
const blocking = JSON.parse(readFileSync(`${directory}/blocking.json`, 'utf8'));
assert.equal(all.Results[0].Vulnerabilities.length, 1, 'Unfixed finding stays visible');
assert.equal(blocking.Results[0].Vulnerabilities.length, 0, 'Unfixed finding does not block');
JS
echo 'All container scan policy/failure checks passed.'
