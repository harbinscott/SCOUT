#!/bin/sh
set -eu

if [ "${HTTPS_ENABLED:-true}" = "true" ]; then
  cert_file="${TLS_CERT_FILE:-/app/.certs/tls.crt}"
  key_file="${TLS_KEY_FILE:-/app/.certs/tls.key}"
  if [ ! -s "$cert_file" ] || [ ! -s "$key_file" ]; then
    mkdir -p "$(dirname "$cert_file")" "$(dirname "$key_file")"
    umask 077
    openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 825 \
      -keyout "$key_file" -out "$cert_file" \
      -subj "/CN=${TLS_COMMON_NAME:-SCOUT}" \
      -addext "subjectAltName=IP:${TLS_IP:-127.0.0.1},DNS:${TLS_DNS:-localhost}"
    echo "Generated a persistent self-signed SCOUT certificate for ${TLS_IP:-127.0.0.1}."
  fi
fi

exec "$@"
