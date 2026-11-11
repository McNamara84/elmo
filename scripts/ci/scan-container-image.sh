#!/usr/bin/env bash
set -euo pipefail

if [[ ( $# != 3 && $# != 4 ) || ! -s "$1" || ! "$2" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo 'Usage: scan-container-image.sh <image.tar> <expected-image-id> <report-directory> [official-mariadb-digest-ref]' >&2
  exit 2
fi

# Only explicitly selected official, immutable MariaDB refs get the upstream
# reporting policy. Web images keep the default fixable HIGH/CRITICAL gate.
vulnerability_exit_code=1
policy='block-fixable'
if [[ $# == 4 ]]; then
  if [[ ! "$4" =~ ^mariadb:[a-zA-Z0-9_.-]+@sha256:[a-f0-9]{64}$ ]]; then
    echo 'The reporting exception requires a digest-pinned official MariaDB reference.' >&2
    exit 2
  fi
  vulnerability_exit_code=0
  policy='report-only-official-mariadb'
fi

readonly scanner_image='aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb'
archive="$(realpath "$1")"
expected_image_id="$2"
mkdir -p "$3" "${TRIVY_CACHE_DIR:?Set TRIVY_CACHE_DIR to a writable cache directory}"
report_root="$(realpath "$3")"
cache="$(realpath "$TRIVY_CACHE_DIR")"
# Never let an earlier report hide a scanner failure or missing output.
report_dir="$(mktemp -d "$report_root/scan.XXXXXX")"
node --input-type=module - "$report_dir/policy.json" "$policy" "${4:-}" "$expected_image_id" <<'JS'
import { writeFileSync } from 'node:fs';
const [path, policy, imageRef, imageId] = process.argv.slice(2);
writeFileSync(path, `${JSON.stringify({ policy, imageRef, imageId }, null, 2)}\n`);
JS
echo "Container vulnerability policy: $policy"

docker_args=(run --rm --user "$(id -u):$(id -g)"
  --env TRIVY_DISABLE_VEX_NOTICE=true
  --mount "type=bind,source=$archive,target=/input/image.tar,readonly"
  --mount "type=bind,source=$report_dir,target=/scan"
  --mount "type=bind,source=$cache,target=/cache"
  --workdir /scan "$scanner_image")
scan_args=(image --config= --ignorefile= --input /input/image.tar
  --cache-dir /cache --scanners vuln --pkg-types 'os,library'
  --severity 'HIGH,CRITICAL' --list-all-pkgs --format json
  --skip-version-check --timeout 10m)

validate_report() {
  node --input-type=module - "$1" "$expected_image_id" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(report.SchemaVersion, 2, 'Unsupported or incomplete Trivy report');
assert.equal(report.ArtifactType, 'container_image', 'Expected a container image report');
assert.equal(report.Metadata?.ImageID, process.argv[3], 'Report does not match the exported image');
assert.ok(report.Metadata?.OS?.Family, 'Missing OS detection');
assert.ok(Array.isArray(report.Results) && report.Results.some(result =>
  result.Class === 'os-pkgs' && Array.isArray(result.Packages) && result.Packages.length > 0
), 'Missing OS package analysis');
JS
}

# Keep unfixed HIGH/CRITICAL findings visible in the full report.
docker "${docker_args[@]}" "${scan_args[@]}" --ignore-unfixed=false --exit-code 0 --output /scan/all.json
validate_report "$report_dir/all.json"
docker "${docker_args[@]}" convert --config= --ignorefile= --format table \
  --output /scan/all.txt /scan/all.json
cat "$report_dir/all.txt"

# Only vulnerability findings are nonblocking for official MariaDB. Trivy
# operational failures and missing/invalid/mismatched results always fail.
scan_status=0
docker "${docker_args[@]}" "${scan_args[@]}" --ignore-unfixed --exit-code "$vulnerability_exit_code" \
  --output /scan/blocking.json || scan_status=$?
validate_report "$report_dir/blocking.json"
if [[ "$scan_status" != 0 ]]; then
  echo "Container scan blocked the image (scanner exit code $scan_status)." >&2
elif [[ "$vulnerability_exit_code" == 0 ]]; then
  echo 'Official MariaDB accepted; HIGH/CRITICAL findings remain in the scan reports.'
fi
exit "$scan_status"
