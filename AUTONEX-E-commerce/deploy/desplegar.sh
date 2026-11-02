#!/usr/bin/env bash
# Despliegue de AUTONEX en un servidor Linux (sin root): instala, compila el frontend y (re)inicia el servicio
# (como servicio de systemd: deploy/autonex.service).
#   bash deploy/desplegar.sh            -> instala + build + reinicia
#   bash deploy/desplegar.sh --seed     -> además recrea la base con el seed
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f server/.env ]; then
  echo "Falta server/.env (copiá server/.env.example y completalo)." >&2
  exit 1
fi

# Subruta pública: la misma que BASE_PATH de server/.env (ej: /autonex -> /autonex/)
BASE_PATH="$(grep -E '^BASE_PATH=' server/.env | cut -d= -f2- | tr -d '"' || true)"
export VITE_BASE_PATH="${BASE_PATH:-}/"

echo "1/4 Dependencias"
npm install --no-audit --no-fund

if [ "${1:-}" = "--seed" ]; then
  echo "2/4 Base de datos (seed)"
  npm run db:seed
else
  echo "2/4 Base de datos: sin cambios (usá --seed para recrearla)"
fi

echo "3/4 Compilando el frontend con base ${VITE_BASE_PATH}"
npm run build

echo "4/4 Reiniciando AUTONEX"
if ! systemctl cat autonex.service >/dev/null 2>&1; then
  echo "Falta instalar el servicio de systemd (deploy/autonex.service): ver el README, sección Despliegue." >&2
  exit 1
fi
systemctl restart autonex
PORT="$(grep -E '^PORT=' server/.env | cut -d= -f2- || echo 3200)"
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT:-3200}${BASE_PATH:-}/api/salud" >/dev/null 2>&1; then
    echo "AUTONEX está corriendo: http://127.0.0.1:${PORT:-3200}${BASE_PATH:-}/"
    exit 0
  fi
  sleep 1
done
echo "AUTONEX no respondió. Mirá los logs con: journalctl -u autonex -n 50" >&2
exit 1
