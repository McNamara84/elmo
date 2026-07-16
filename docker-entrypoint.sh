#!/bin/sh
set -e

# Give www-data ownership of the xml folder every start when present.
#if [ -d /var/www/html/xml ]; then
#  chown -R www-data:www-data /var/www/html/xml
#fi

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

# Wait for the DB using mysqladmin ping (more reliable)
wait_for_db() {
  local db_host="${DB_HOST:-db}"
  local db_port="${DB_PORT:-3306}"
  echo "Waiting for MariaDB at ${db_host}:${db_port}..."
  until mysqladmin ping -h "${db_host}" -P "${db_port}" -u "${DB_USER}" -p"${DB_PASSWORD}" --silent >/dev/null 2>&1; do
    echo "... still waiting"
    sleep 2
  done
  echo "MariaDB reachable at ${db_host}:${db_port}"
}

wait_for_db

# Create application database and user with read/write permissions if not exists
# in MariaBD the users priveleges are tied to a specific host, so we need to explicitly create 
# the same user on different hosts to allow connection in different scenarios. 
echo "Configuring database and user..."
db_host="${DB_HOST:-db}"
db_port="${DB_PORT:-3306}"
mysql -h "${db_host}" -P "${db_port}" -uroot -p"${ROOT_PASSWORD}" <<-EOSQL
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

# Always run install.php after DB is reachable.
INSTALL_ACTION="${INSTALL_ACTION:-basic}"
echo "Running database setup via install.php (${INSTALL_ACTION})..."
php /var/www/html/install.php "${INSTALL_ACTION}"
echo "Database setup finished."

# Clean up install files (optional)
rm -f /var/www/html/install.{php,html} || true

exec "$@"
