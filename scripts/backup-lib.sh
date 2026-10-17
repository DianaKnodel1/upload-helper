#!/usr/bin/env bash
# Gemeinsame Hilfsfunktionen für Orchestrator, Prüfung und Wächter.
# Erwartet BACKUP_DIR und optional ALERT_* aus backup-orchestrator.env.

# Alarm per Telegram und/oder E-Mail. Fehlt beides, nur Ausgabe ins Journal.
send_alert() {
  local text="$1"
  echo "ALARM: $text" >&2
  if [ -n "${ALERT_TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${ALERT_TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsS -m 20 "https://api.telegram.org/bot${ALERT_TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${ALERT_TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=${text}" >/dev/null 2>&1 || echo "Telegram-Alarm fehlgeschlagen" >&2
  fi
  if [ -n "${ALERT_EMAIL:-}" ] && command -v mail >/dev/null; then
    printf '%s\n' "$text" | mail -s "Portal-Backup: Alarm" "${ALERT_EMAIL}" || echo "Mail-Alarm fehlgeschlagen" >&2
  fi
}

# Lokaler Status — funktioniert auch, wenn das Backend gesperrt ist.
write_local_status() {
  local status="$1" message="$2" stamp="$3" size="$4" dur="$5" archive="$6"
  local f="${BACKUP_DIR}/logs/latest.json"
  mkdir -p "${BACKUP_DIR}/logs"
  local line
  line=$(printf '{"timestamp":"%s","stamp":"%s","status":"%s","message":"%s","size":"%s","duration_ms":%s,"archive":"%s"}' \
    "$(date -Iseconds)" "$stamp" "$status" "${message//\"/\'}" "$size" "${dur:-0}" "$archive")
  echo "$line" > "$f"
  echo "$line" >> "${BACKUP_DIR}/logs/history.jsonl"
  [ "$status" = "success" ] && echo "$line" > "${BACKUP_DIR}/logs/last-success.json"
  return 0
}
