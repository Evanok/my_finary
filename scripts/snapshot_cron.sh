#!/bin/bash
# Daily portfolio snapshot with email alert on failure.
# Requires GMAIL_APP_PASSWORD to be set in /home/arthur/.env_cron

set -euo pipefail

ENV_FILE="/home/arthur/.env_cron"
if [[ -f "$ENV_FILE" ]]; then
  source "$ENV_FILE"
fi

GMAIL_USER="${GMAIL_USER:?GMAIL_USER must be set in $ENV_FILE}"
SESSION_COOKIE="${SESSION_COOKIE:?SESSION_COOKIE must be set in $ENV_FILE}"
SNAPSHOT_URL="http://localhost:3000/api/portfolio/snapshot"
LOG_FILE="/home/arthur/work/my_finary/snapshot.log"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running snapshot..." >> "$LOG_FILE"

HTTP_STATUS=$(curl -s -o /tmp/snapshot_response.txt -w "%{http_code}" \
  -X POST \
  -H "Cookie: session=$SESSION_COOKIE" \
  "$SNAPSHOT_URL")

RESPONSE=$(cat /tmp/snapshot_response.txt)
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] HTTP $HTTP_STATUS — $RESPONSE" >> "$LOG_FILE"

if [[ "$HTTP_STATUS" != "201" ]]; then
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] ERROR: sending alert email" >> "$LOG_FILE"

  curl --ssl-reqd \
    --url 'smtps://smtp.gmail.com:465' \
    --user "${GMAIL_USER}:${GMAIL_APP_PASSWORD}" \
    --mail-from "$GMAIL_USER" \
    --mail-rcpt "$GMAIL_USER" \
    --upload-file - <<EOF
From: My Finary <${GMAIL_USER}>
To: ${GMAIL_USER}
Subject: [my_finary] Snapshot failed (HTTP $HTTP_STATUS)
Content-Type: text/plain

Portfolio snapshot failed on $(date -u '+%Y-%m-%d at %H:%M UTC').

HTTP status: $HTTP_STATUS
Response: $RESPONSE

$(if [[ "$HTTP_STATUS" == "207" ]]; then echo "Some prices could not be fetched. Check failedSymbols in the response above."; fi)

Check the log: $LOG_FILE
EOF

  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Alert email sent." >> "$LOG_FILE"
fi
