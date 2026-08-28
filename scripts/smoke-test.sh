#!/usr/bin/env bash
# Smoke test de integración real contra la pila levantada con docker compose.
# No simula nada: usa HTTP contra la aplicación y la base de datos reales.
#
# 1. /health debe responder 200 y reportar la base de datos operativa.
# 2. Recorrido de negocio: crear -> listar -> resumen -> transición -> eliminar.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }

echo "== 1. GET /health =="
health_body="$(mktemp)"
health_status="$(curl -s -o "$health_body" -w '%{http_code}' --max-time 10 "${BASE_URL}/health")"
cat "$health_body"; echo
[[ "$health_status" == "200" ]] || fail "/health devolvió ${health_status}, se esperaba 200"
grep -q '"database"' "$health_body" || fail "/health no reporta el estado de la base de datos"
grep -q '"status":"ok"' "$health_body" || fail "/health no reporta status ok"

echo "== 2. POST /api/promotions =="
create_body="$(mktemp)"
create_status="$(curl -s -o "$create_body" -w '%{http_code}' --max-time 10 \
  -X POST "${BASE_URL}/api/promotions" \
  -H 'Content-Type: application/json' \
  -d '{
        "name": "Smoke test - descuento de verificación",
        "targetType": "CATEGORY",
        "category": "Bebidas",
        "discountType": "PERCENTAGE",
        "discountValue": 15,
        "startDate": "2020-01-01",
        "endDate": "2099-12-31"
      }')"
cat "$create_body"; echo
[[ "$create_status" == "201" ]] || fail "POST /api/promotions devolvió ${create_status}, se esperaba 201"

promotion_id="$(sed -n 's/.*"id":\([0-9]*\).*/\1/p' "$create_body" | head -1)"
[[ -n "$promotion_id" ]] || fail "no se pudo extraer el id de la promoción creada"
echo "Promoción creada con id=${promotion_id}"

echo "== 3. Validación rechazada (porcentaje fuera de rango) =="
invalid_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST "${BASE_URL}/api/promotions" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Inválida","targetType":"CATEGORY","category":"Bebidas","discountType":"PERCENTAGE","discountValue":150,"startDate":"2026-01-01","endDate":"2026-02-01"}')"
[[ "$invalid_status" == "422" ]] || fail "un porcentaje de 150 devolvió ${invalid_status}, se esperaba 422"
echo "OK: porcentaje inválido rechazado con 422"

echo "== 4. GET /api/promotions =="
list_body="$(mktemp)"
list_status="$(curl -s -o "$list_body" -w '%{http_code}' --max-time 10 "${BASE_URL}/api/promotions")"
[[ "$list_status" == "200" ]] || fail "GET /api/promotions devolvió ${list_status}"
grep -q "\"id\":${promotion_id}" "$list_body" || fail "la promoción ${promotion_id} no aparece en el listado"
echo "OK: la promoción persistida aparece en el listado"

echo "== 5. GET /api/promotions/summary =="
summary_body="$(mktemp)"
summary_status="$(curl -s -o "$summary_body" -w '%{http_code}' --max-time 10 "${BASE_URL}/api/promotions/summary")"
cat "$summary_body"; echo
[[ "$summary_status" == "200" ]] || fail "GET /api/promotions/summary devolvió ${summary_status}"
grep -q '"activeToday"' "$summary_body" || fail "el resumen no incluye activeToday"

echo "== 6. Transición SCHEDULED -> ACTIVE =="
transition_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST "${BASE_URL}/api/promotions/${promotion_id}/transitions" \
  -H 'Content-Type: application/json' -d '{"to":"ACTIVE"}')"
[[ "$transition_status" == "200" ]] || fail "la transición a ACTIVE devolvió ${transition_status}"

echo "== 7. Eliminar una promoción ACTIVE debe fallar con 409 =="
delete_active_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X DELETE "${BASE_URL}/api/promotions/${promotion_id}")"
[[ "$delete_active_status" == "409" ]] || fail "eliminar una promoción ACTIVE devolvió ${delete_active_status}, se esperaba 409"

echo "== 8. Limpieza: finalizar la promoción de prueba =="
curl -s -o /dev/null -X POST "${BASE_URL}/api/promotions/${promotion_id}/transitions" \
  -H 'Content-Type: application/json' -d '{"to":"FINISHED"}'

echo ""
echo "SMOKE OK: la aplicación, la API y la base de datos responden correctamente."
