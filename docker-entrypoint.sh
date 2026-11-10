#!/bin/sh
set -e

# A stopped container may retain its writable layer; never reuse old readiness.
rm -f /tmp/elmo-startup-ready

INSTALL_ACTION="${INSTALL_ACTION:-basic}"
case "$INSTALL_ACTION" in
  basic|complete|skip) ;;
  *) echo "Invalid INSTALL_ACTION: expected basic, complete, or skip." >&2; exit 2 ;;
esac

warn_missing_dir() {
  dir_path="$1"
  fix_hint="$2"

  if [ ! -d "${dir_path}" ]; then
    echo "===================================================================="
    echo "WARNING: Missing dependency directory: ${dir_path}"
    echo "${fix_hint}"
    echo "Hint: A bind mount may have replaced /var/www/html inside the container."
    echo "===================================================================="
  fi
}

# Runtime sanity checks only. Dependencies must be built before container start.
warn_missing_dir "/var/www/html/vendor" "Run 'composer install' locally or rebuild the image."
warn_missing_dir "/var/www/html/node_modules" "Run 'npm install' locally or rebuild the image."

# Submission mail reads XML_SUBMIT_ADDRESS at request time (settings.elmo.php).
# An empty value falls back to xmlsubmit@example.com.
if [ -n "${XML_SUBMIT_ADDRESS}" ]; then
  echo "Submission mail recipient: ${XML_SUBMIT_ADDRESS}"
else
  echo "===================================================================="
  echo "WARNING: XML_SUBMIT_ADDRESS is empty."
  echo "Submission mail will be sent to xmlsubmit@example.com."
  echo "Set XML_SUBMIT_ADDRESS in the Portainer stack environment, then update the stack."
  echo "===================================================================="
fi

# Ensure a settings.php exists; in production always refresh from settings.elmo.php
# In local development, keep the existing settings.php
# Set LOCAL_DEVELOPMENT=true in docker-compose for local deployments
if [ "${LOCAL_DEVELOPMENT}" = "true" ]; then
  # Local development mode - keep existing settings.php
  if [ ! -f /var/www/html/settings.php ]; then
    echo "Local development: settings.php not found, creating from settings.elmo.php"
    cp /var/www/html/settings.elmo.php /var/www/html/settings.php
    #chown www-data:www-data /var/www/html/settings.php
  else
    echo "Local development: keeping existing settings.php"
  fi
else
  # Production mode - always refresh settings.php for environment variable changes
  echo "Production mode: refreshing settings.php from settings.elmo.php"
  cp /var/www/html/settings.elmo.php /var/www/html/settings.php
  #chown www-data:www-data /var/www/html/settings.php
fi

# Authenticate before provisioning; the application database/user may not exist yet.
echo "Waiting for authenticated database server access..."
php /var/www/html/scripts/container_database.php wait-server

# Create application database and user with read/write permissions if not exists
# in MariaBD the users priveleges are tied to a specific host, so we need to explicitly create 
# the same user on different hosts to allow connection in different scenarios. 
echo "Configuring database and user..."
db_host="${DB_HOST:-db}"
db_port="${DB_PORT:-3306}"
mysql --connect-timeout=5 -h "${db_host}" -P "${db_port}" -uroot -p"${ROOT_PASSWORD}" <<-EOSQL
  CREATE DATABASE IF NOT EXISTS ${DB_NAME};
  CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
  GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'%';

  CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
  GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
  
  CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
  GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
  FLUSH PRIVILEGES;
EOSQL
echo "Database and user configured at ${db_host}:${db_port}."

# basic/complete deliberately reset the cache DB on every start, even when its
# volume already exists. One DB lock covers both the reset and ERNIE mapping.
php /var/www/html/scripts/container_database.php initialize "$INSTALL_ACTION"

exec "$@"
