#!/usr/bin/env bash
# keep club — daily Supabase keepalive. Free projects pause after 7 days without
# database activity. A POST to /rest/v1/rpc/ is uncacheable and runs a real query
# inside sync_get; the all-zero hash matches no key, so it reads and writes nothing.
set -uo pipefail
LOG=/home/konrad/logs/supabase-keepalive.log
ENVF=/home/konrad/vault/_agent/.env
URL='https://dyaxdgpaideblyhpxyft.supabase.co/rest/v1/rpc/sync_get'
ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5YXhkZ3BhaWRlYmx5aHB4eWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMTg2MjUsImV4cCI6MjEwMDY5NDYyNX0.CDDeyQso3XnxiYg0f5x4uy99n6JoyHgEqm1cJN0wvIk'
BODY='{"p_app":"keepalive","p_key_hash":"0000000000000000000000000000000000000000000000000000000000000000"}'

tell() {  # same bot and DM hermes already uses
  . "$ENVF"
  /usr/bin/curl -sS -m 20 -o /dev/null \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_HOME_CHANNEL}" --data-urlencode "text=${1}"
}

mkdir -p "$(dirname "$LOG")"
for try in 1 2 3; do
  out=$(/usr/bin/curl -sS -m 25 -w '|%{http_code}' -X POST "$URL" \
    -H "apikey: ${ANON}" -H "Authorization: Bearer ${ANON}" \
    -H 'Content-Type: application/json' -d "$BODY" 2>&1)
  code=${out##*|}; body=${out%|*}
  [ "$code" = 200 ] && [ "${body:0:1}" = '[' ] && break
  [ "$try" != 3 ] && sleep 30
done
printf '%s http=%s %s\n' "$(date -Is)" "$code" "${body:0:120}" >> "$LOG"
tail -n 400 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

if [ "$code" != 200 ] || [ "${body:0:1}" != '[' ]; then
  tell "keep club: Supabase keepalive FAILED after 3 tries — http ${code}. Free project pauses after 7 idle days; sync dies silently. ${body:0:200}"
elif [ "$(date +%u)" = 7 ]; then
  tell "keep club keepalive: $(tail -n 7 "$LOG" | grep -c 'http=200')/7 OK this week."
fi
