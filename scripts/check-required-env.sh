#!/usr/bin/env bash
# Falla de forma explícita si falta alguna variable requerida, nombrando todas
# las ausentes de una vez. Se ejecuta antes de levantar la pila en CI.
set -uo pipefail

REQUIRED_VARS=(
  MSSQL_SA_PASSWORD
  DB_NAME
  DB_USER
  APP_TIMEZONE
)

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "ERROR: faltan variables de entorno requeridas:" >&2
  for var in "${missing[@]}"; do
    echo "  - $var" >&2
  done
  echo "" >&2
  echo "En local: copia .env.example a .env y complétalas." >&2
  echo "En GitHub Actions: configúralas en Settings > Secrets and variables > Actions." >&2
  exit 1
fi

echo "Variables de entorno requeridas: OK (${#REQUIRED_VARS[@]} verificadas)."
