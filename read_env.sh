#!/bin/bash
echo "=== Environment Variables ==="
# to make this script executable, run:
# chmod +x read_env.sh
# to run this script:
# ./read_env.sh
echo "CONFIG_VERSION: ${CONFIG_VERSION:-Not set}"
echo "DB_USER: ${DB_USER:-Not set}"
echo "DB_PASSWORD: ${DB_PASSWORD:-Not set}"
echo "TZ: ${TZ:-Not set}"
echo "DB_HOST: ${DB_HOST:-Not set}"
echo "DB_NAME: ${DB_NAME:-Not set}"

echo ""
echo "=== All Environment Variables ==="
env | while IFS='=' read -r key value; do
    # Hide sensitive values
    if [[ "${key,,}" == *"password"* ]]; then
        echo "$key=[HIDDEN]"
    else
        echo "$key=$value"
    fi
done