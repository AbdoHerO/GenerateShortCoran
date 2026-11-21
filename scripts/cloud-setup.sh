#!/usr/bin/env bash
# Run at the start of EVERY cloud session (Claude Code on the web, Ubuntu 24.04). Safe to run twice.
#   bash scripts/cloud-setup.sh
# The environment's own setup script should already have installed ffmpeg (see docs/MASTER_DOCUMENTATION.md §14).
set -euo pipefail
cd "$(dirname "$0")/.."

ok()   { printf '  [ok] %s\n' "$*"; }
fail() { printf '  [!!] %s\n' "$*"; FAILED=1; }
FAILED=0

echo "== system tools"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg missing: installing"
  (apt-get update -y && apt-get install -y ffmpeg) >/dev/null 2>&1 || sudo -n sh -c 'apt-get update -y && apt-get install -y ffmpeg' >/dev/null 2>&1 || true
fi
command -v ffmpeg >/dev/null 2>&1 && ok "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)" || fail "ffmpeg not installed (add 'apt-get install -y ffmpeg' to the environment setup script)"
command -v node >/dev/null 2>&1 && ok "node $(node --version)" || fail "node missing"
command -v python3 >/dev/null 2>&1 && ok "$(python3 --version)" || fail "python3 missing"

echo "== python venv (.venv)"
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/python -c "import fontTools" 2>/dev/null || .venv/bin/pip install --quiet fonttools anthropic
.venv/bin/python -c "import fontTools; print('  [ok] fonttools', fontTools.version)"

echo "== renderer dependencies"
if [ ! -d renderer/node_modules/playwright-core ]; then (cd renderer && npm ci --no-audit --no-fund >/dev/null); fi
[ -d renderer/node_modules/playwright-core ] && ok "playwright-core installed" || fail "npm ci failed in renderer/"

echo "== browser"
if [ -n "${CHROME_PATH:-}" ] && [ -x "${CHROME_PATH}" ]; then ok "CHROME_PATH=${CHROME_PATH}"
elif [ -x /usr/bin/google-chrome ]; then export CHROME_PATH=/usr/bin/google-chrome; ok "using /usr/bin/google-chrome (export CHROME_PATH=/usr/bin/google-chrome)"
else echo "  no Chrome found: installing Playwright Chromium"; (cd renderer && npx --yes playwright@1.49.1 install --with-deps chromium >/dev/null 2>&1) && ok "playwright chromium" || fail "no browser (set CHROME_PATH)"; fi

echo "== network (data sources)"
for u in https://api.quran.com/api/v4/chapters/1 https://api.alquran.cloud/v1/surah/1/quran-uthmani; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -A quran-video-builder/0.1 "$u" || echo 000)
  [ "$code" = 200 ] && ok "$u" || fail "$u -> HTTP $code (add the domain to the environment's allowed domains)"
done
code=$(curl -s -o /dev/null -w '%{http_code}' -r 0-0 -A quran-video-builder/0.1 https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/1.mp3 || echo 000)
case "$code" in 200|206) ok "download.quranicaudio.com" ;; *) fail "download.quranicaudio.com -> HTTP $code (allow it)" ;; esac

echo "== Creative Hub"
if [ -n "${CREATIVE_HUB_URL:-}" ] && [ -n "${CREATIVE_HUB_TOKEN:-}" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${CREATIVE_HUB_TOKEN}" "${CREATIVE_HUB_URL}/api/agent/v1" || echo 000)
  [ "$code" = 200 ] && ok "agent API reachable, token accepted" || fail "Creative Hub agent API -> HTTP $code (allow creatives.abdocloud.com; check the token)"
else
  fail "CREATIVE_HUB_URL / CREATIVE_HUB_TOKEN not set in the environment variables"
fi

echo "== catalog"
[ -f data/catalog.json ] && ok "data/catalog.json" || (.venv/bin/python -I -X utf8 pipeline/catalog.py && ok "catalog built")

if [ "$FAILED" = 1 ]; then echo "SETUP INCOMPLETE: fix the [!!] items before producing anything."; exit 1; fi
echo "SETUP OK"
