#!/usr/bin/env bash
# Espera a que /health responda 200. SQL Server tarda entre 30 y 60 segundos en
# aceptar conexiones, así que sin esta espera el smoke test sería intermitente.
#
# Uso: wait-for-health.sh <url> [timeout_segundos]
set -uo pipefail

URL="${1:-http://localhost:3000/health}"
TIMEOUT="${2:-180}"
INTERVAL=3

echo "Esperando a que ${URL} responda 200 (timeout ${TIMEOUT}s)..."
elapsed=0

while (( elapsed < TIMEOUT )); do
  status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL" || echo "000")"
  if [[ "$status" == "200" ]]; then
    echo "OK: ${URL} respondió 200 tras ${elapsed}s."
    exit 0
  fi
  printf '  [%3ds] estado=%s\n' "$elapsed" "$status"
  sleep "$INTERVAL"
  elapsed=$(( elapsed + INTERVAL ))
done

echo "ERROR: ${URL} no respondió 200 en ${TIMEOUT}s." >&2
exit 1
