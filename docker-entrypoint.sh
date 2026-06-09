#!/bin/sh
set -e

# Give www-data ownership of the xml folder every start when present.
if [ -d /var/www/html/xml ]; then
  chown -R www-data:www-data /var/www/html/xml
fi

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
    chown www-data:www-data /var/www/html/settings.php
  else
    echo "Local development: keeping existing settings.php"
  fi
else
  # Production mode - always refresh settings.php for environment variable changes
  echo "Production mode: refreshing settings.php from settings.elmo.php"
  cp /var/www/html/settings.elmo.php /var/www/html/settings.php
  chown www-data:www-data /var/www/html/settings.php
fi

# Wait for the DB using mysqladmin ping (more reliable)
wait_for_db() {
  echo "Waiting for MariaDB at ${DB_HOST}..."
  until mysqladmin ping -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" --silent >/dev/null 2>&1; do
    echo "... still waiting"
    sleep 2
  done
  echo "MariaDB reachable"
}

# Check if tables already exist in the target schema
db_has_tables() {
  TABLE_COUNT=$(mysql -N -s -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")
  if [ -z "${TABLE_COUNT}" ]; then
    TABLE_COUNT=0
  fi
  [ "${TABLE_COUNT}" -gt 0 ]
}

wait_for_db

# set the default to keep the data
DB_INIT_MODE="${DB_INIT_MODE:-keep_data}"
INSTALL_ACTION="${INSTALL_ACTION:-basic}"

if [ "${DB_INIT_MODE}" = "skip" ]; then
  echo "DB_INIT_MODE=skip - no install attempt."
else
  if [ "${DB_INIT_MODE}" = "drop_data" ]; then
    echo "Running full database setup (DB_INIT_MODE=drop_data)..."
    php /var/www/html/install.php "${INSTALL_ACTION}"
  elif [ "${DB_INIT_MODE}" = "keep_data" ]; then
    if db_has_tables; then
      echo "DB_INIT_MODE=keep_data and database schema for '${DB_NAME}' already present - install.php is not called."
    else
      echo "DB_INIT_MODE=keep_data but no tables exist yet. Running initial database setup (${INSTALL_ACTION})..."
      php /var/www/html/install.php "${INSTALL_ACTION}"
    fi
  else
    echo "Unknown DB_INIT_MODE: '${DB_INIT_MODE}'. Skipping install."
  fi
  echo "Database setup finished."
fi



# Clean up install files (optional)
rm -f /var/www/html/install.{php,html} || true

exec "$@"
