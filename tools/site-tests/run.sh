#!/bin/sh
# Runs the Site Encyclopedia's Node tests (synthetic data only; nothing private). Usage: tools/site-tests/run.sh
cd "$(dirname "$0")" || exit 1
fail=0
for f in test-*.js; do
  out=$(node "$f" 2>&1); code=$?
  printf '%-24s %s\n' "$f" "$(echo "$out" | tail -1)"
  [ $code -ne 0 ] && { echo "$out" | grep '^FAIL'; fail=1; }
done
exit $fail
