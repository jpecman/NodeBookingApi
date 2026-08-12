#!/usr/bin/env bash
#
# Dependency security check for NodeBookingApi.
#
# Runs the layered checks that `npm audit` alone does not cover: production-scoped
# advisories, registry signature/provenance verification, pending install scripts,
# lockfile/tree integrity, and version drift.
#
#   ./scripts/security-check.sh          # full run
#   ./scripts/security-check.sh --ci     # fail on any BLOCKING check (for pipelines)
#   ./scripts/security-check.sh --quiet  # summary only
#
# Exit codes: 0 all blocking checks passed, 1 a blocking check failed.
# Advisory checks (outdated, external DBs) never affect the exit code.

set -uo pipefail

CI_MODE=0
QUIET=0
for arg in "$@"; do
  case "$arg" in
    --ci) CI_MODE=1 ;;
    --quiet) QUIET=1 ;;
    -h | --help)
      sed -n '3,13p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SELF="$REPO_ROOT/scripts/$(basename "${BASH_SOURCE[0]}")"
cd "$REPO_ROOT" || exit 1

# Node lives in the nix shell, not on PATH. Re-enter it once rather than making
# every caller remember the prefix.
if ! command -v npm >/dev/null 2>&1; then
  if command -v nix >/dev/null 2>&1; then
    exec nix develop -c "$SELF" "$@"
  fi
  echo "npm not found, and nix is unavailable to provide it." >&2
  exit 127
fi

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  BOLD=$'\033[1m' RED=$'\033[31m' GREEN=$'\033[32m' YELLOW=$'\033[33m' DIM=$'\033[2m' RESET=$'\033[0m'
else
  BOLD='' RED='' GREEN='' YELLOW='' DIM='' RESET=''
fi

FAILURES=()
WARNINGS=()

section() {
  ((QUIET)) && return 0
  printf '\n%s── %s %s\n' "$BOLD" "$1" "$RESET"
}

detail() {
  ((QUIET)) && return 0
  printf '%s%s%s\n' "$DIM" "$1" "$RESET"
}

pass() {
  ((QUIET)) && return 0
  printf '%s  ok%s  %s\n' "$GREEN" "$RESET" "$1"
}

fail() {
  printf '%s fail%s  %s\n' "$RED" "$RESET" "$1"
  FAILURES+=("$1")
}

warn() {
  printf '%s warn%s  %s\n' "$YELLOW" "$RESET" "$1"
  WARNINGS+=("$1")
}

# ---------------------------------------------------------------------------
# 1. Known vulnerabilities
#
# Split prod from dev deliberately: a CVE in jest or @nestjs/cli never reaches a
# running server, so it must not gate a release the way a prod one does.
# ---------------------------------------------------------------------------
section "1. Known vulnerabilities (npm audit)"

prod_audit="$(npm audit --omit=dev 2>&1)"
if grep -q "found 0 vulnerabilities" <<<"$prod_audit"; then
  pass "production dependencies: no known advisories"
else
  fail "production dependencies have advisories"
  detail "$prod_audit"
fi

full_audit="$(npm audit 2>&1)"
if grep -q "found 0 vulnerabilities" <<<"$full_audit"; then
  pass "all dependencies (incl. dev): no known advisories"
else
  warn "dev-only advisories present — build-time exposure, triage but do not block"
  detail "$full_audit"
fi

# ---------------------------------------------------------------------------
# 2. Authenticity — did these bytes really come from the registry?
#
# Answers a different question than audit: signature failures mean tampering or a
# poisoned mirror, which outranks any stale CVE.
# ---------------------------------------------------------------------------
section "2. Registry signatures and provenance"

sig_output="$(npm audit signatures 2>&1)"
if grep -qE "[0-9]+ packages have verified registry signatures" <<<"$sig_output"; then
  pass "$(grep -oE '[0-9]+ packages have verified registry signatures' <<<"$sig_output" | head -1)"
  attested="$(grep -oE '[0-9]+ packages have verified attestations' <<<"$sig_output" | head -1)"
  [[ -n "$attested" ]] && detail "  ${attested} (Sigstore build provenance)"
else
  fail "signature verification did not report a clean result"
  detail "$sig_output"
fi

if grep -qiE "invalid|missing|untrusted" <<<"$sig_output"; then
  fail "some packages have invalid or missing signatures"
  detail "$sig_output"
fi

# ---------------------------------------------------------------------------
# 3. Install scripts — arbitrary code at install time, the classic vector.
#    npm 11 blocks them by default; this surfaces what is awaiting approval.
# ---------------------------------------------------------------------------
section "3. Install scripts pending approval"

pending="$(npm install --dry-run 2>&1 | grep -E '^npm warn allow-scripts   ' | sed 's/^npm warn allow-scripts   //')"
if [[ -z "$pending" ]]; then
  pass "no unreviewed install scripts"
else
  warn "$(wc -l <<<"$pending" | tr -d ' ') package(s) have unreviewed install scripts"
  while IFS= read -r line; do detail "  $line"; done <<<"$pending"
  detail "  review with: npm approve-scripts --allow-scripts-pending"
fi

# ---------------------------------------------------------------------------
# 4. Tree integrity — lockfile in sync, no unmet or invalid resolutions.
# ---------------------------------------------------------------------------
section "4. Dependency tree integrity"

if ls_output="$(npm ls --all 2>&1)"; then
  pass "installed tree matches package.json and the lockfile"
else
  fail "tree is inconsistent (unmet, invalid, or extraneous packages)"
  detail "$(grep -E 'invalid|missing|extraneous|UNMET' <<<"$ls_output" | head -20)"
fi

if [[ -f package-lock.json ]]; then
  pass "package-lock.json present (pins exact versions + integrity hashes)"
else
  fail "package-lock.json is missing — installs are not reproducible"
fi

# ---------------------------------------------------------------------------
# 5. Version drift — advisory only. Some pins here are deliberate:
#    typescript is held at 5.x because ts-jest peer-refuses >=7 (see CLAUDE.md).
# ---------------------------------------------------------------------------
section "5. Version drift (advisory)"

outdated="$(npm outdated 2>&1)"
if [[ -z "$(grep -vE '^(Package|Node v|NodeBookingApi)' <<<"$outdated" | tr -d '[:space:]')" ]]; then
  pass "every dependency is at its latest satisfying version"
else
  detail "$outdated"
  detail "  note: typescript is pinned to 5.x on purpose — ts-jest peer-refuses >=7."
  detail "  'outdated' here is not a finding; check the pin rationale before bumping."
fi

# ---------------------------------------------------------------------------
# 6. External databases — broader coverage than npm's own advisory feed.
# ---------------------------------------------------------------------------
section "6. External vulnerability databases"

if command -v osv-scanner >/dev/null 2>&1; then
  if osv_out="$(osv-scanner --lockfile=package-lock.json 2>&1)"; then
    pass "osv.dev: no findings"
  else
    warn "osv.dev reported findings npm audit may not know about"
    detail "$osv_out"
  fi
else
  detail "osv-scanner not installed — skipping automated cross-check."
  detail "  install: nix shell nixpkgs#osv-scanner   (or see google.github.io/osv-scanner)"
  detail "  manual:  https://osv.dev  |  https://github.com/advisories  |  https://socket.dev"
fi

# ---------------------------------------------------------------------------

printf '\n%s── summary %s\n' "$BOLD" "$RESET"
printf '  %d blocking failure(s), %d warning(s)\n' "${#FAILURES[@]}" "${#WARNINGS[@]}"
for f in "${FAILURES[@]:-}"; do [[ -n "$f" ]] && printf '  %sfail%s %s\n' "$RED" "$RESET" "$f"; done
for w in "${WARNINGS[@]:-}"; do [[ -n "$w" ]] && printf '  %swarn%s %s\n' "$YELLOW" "$RESET" "$w"; done

if ((${#FAILURES[@]} > 0)); then
  ((CI_MODE)) && printf '\n%sblocking checks failed%s\n' "$RED" "$RESET"
  exit 1
fi

printf '\n%sall blocking checks passed%s\n' "$GREEN" "$RESET"
exit 0
