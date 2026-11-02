#!/usr/bin/env bash
# Regenera el CSV del DNRPA, carga todo en una base nueva y, si salió bien, la pone en producción
# (la anterior queda como autonex_prev hasta confirmar). Se corre desacoplado: log en /tmp/recarga.log
set -euo pipefail
cd ~/autonex/server
# Subruta pública: la de BASE_PATH en server/.env (ej: /AUTONEX)
BASE_PATH="$(grep -E '^BASE_PATH=' .env | cut -d= -f2- | tr -d '"' || true)"
PSQL="psql -h /var/run/postgresql -v ON_ERROR_STOP=1 -d postgres"
# AUTONEX corre como servicio de systemd (deploy/autonex.service)
detener() { systemctl stop autonex; }
reiniciar() { systemctl restart autonex; }

echo "== ETL $(date +%T)"
node scripts/dnrpa/etl-dnrpa.js --desde-cache 2>&1 | tail -2

echo "== Base nueva $(date +%T)"
$PSQL -c "DROP DATABASE IF EXISTS autonex_nueva" >/dev/null
$PSQL -c "CREATE DATABASE autonex_nueva" >/dev/null
DATABASE_URL="postgresql:///autonex_nueva?host=/var/run/postgresql" node db/seed.js 2>&1 | grep -v "filas…"

echo "== Cambio $(date +%T)"
detener
$PSQL -c "DROP DATABASE IF EXISTS autonex_prev" >/dev/null
$PSQL -c "ALTER DATABASE autonex RENAME TO autonex_prev" >/dev/null
$PSQL -c "ALTER DATABASE autonex_nueva RENAME TO autonex" >/dev/null
cd ~/autonex/client && VITE_BASE_PATH="${BASE_PATH}/" npx vite build 2>&1 | tail -1
cd ~/autonex && reiniciar
for _ in $(seq 1 20); do
  curl -fsS http://127.0.0.1:3200${BASE_PATH}/api/salud >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:3200${BASE_PATH}/api/referencias | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("totales", JSON.stringify(JSON.parse(s).totales)))'
echo "LISTO $(date +%T)"
