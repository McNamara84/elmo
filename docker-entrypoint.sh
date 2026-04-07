#!/bin/sh
set -e

# give www-data ownership of the xml folder every start
chown -R www-data:www-data /var/www/html/xml

# Ensure PHP dependencies are installed
if [ ! -d /var/www/html/vendor ]; then
  echo "📦  Installing PHP dependencies with Composer"
  composer install --no-dev --prefer-dist --optimize-autoloader
fi

# Ensure Node dependencies are installed
if [ ! -d /var/www/html/node_modules ]; then
  echo "📦  Installing Node dependencies"
  npm install --omit=dev
fi

# Ensure a settings.php exists; in production always refresh from settings.elmo.php
# In local development, keep the existing settings.php
# Set LOCAL_DEVELOPMENT=true in docker-compose for local deployments
if [ "${LOCAL_DEVELOPMENT}" = "true" ]; then
  # Local development mode - keep existing settings.php
  if [ ! -f /var/www/html/settings.php ]; then
    echo "⚙️  Local development: settings.php not found, creating from settings.elmo.php"
    cp /var/www/html/settings.elmo.php /var/www/html/settings.php
    chown www-data:www-data /var/www/html/settings.php
  else
    echo "⚙️  Local development: keeping existing settings.php"
  fi
else
  # Production mode - always refresh settings.php for environment variable changes
  echo "⚙️  Production mode: refreshing settings.php from settings.elmo.php"
  cp /var/www/html/settings.elmo.php /var/www/html/settings.php
  chown www-data:www-data /var/www/html/settings.php
fi

# Wait for the DB using mysqladmin ping (more reliable)
wait_for_db() {
  echo "⏳  Waiting for MariaDB at ${DB_HOST}..."
  until mysqladmin ping -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" --silent >/dev/null 2>&1; do
    echo "… still waiting"
    sleep 2
  done
  echo "✅  MariaDB reachable"
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
INSTALL_ACTION="basic"

if [ "${DB_INIT_MODE}" = "skip" ]; then
  echo "⏭️  DB_INIT_MODE=skip — no install attempt."
else
  if [ "${DB_INIT_MODE}" = "drop_data" ]; then
    echo "🚀  Running full database setup (DB_INIT_MODE=drop_data)…"
    php /var/www/html/install.php "${INSTALL_ACTION}"
  elif [ "${DB_INIT_MODE}" = "keep_data" ]; then
    if db_has_tables; then
      echo "⛱️  DB_INIT_MODE=keep_data and database schema for '${DB_NAME}' already present — install.php is not called."
    else
      echo "You chose to keep data, but there are no tables yet. ⏳  Running initial database setup (${INSTALL_ACTION})…"
      php /var/www/html/install.php "${INSTALL_ACTION}"
    fi
  else
    echo "⚠️  Unknown DB_INIT_MODE: '${DB_INIT_MODE}'. Skipping install."
  fi
  echo "🏁  Database setup finished."
fi

# Schema migrations for existing databases
if [ "${DB_INIT_MODE}" != "skip" ] && [ "${DB_INIT_MODE}" != "drop_data" ]; then
  # Make Thesaurus_Keywords.language nullable (was NOT NULL, all attributes are optional per DataCite schema)
  IS_NULLABLE=$(mysql -N -s -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
    -e "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='Thesaurus_Keywords' AND COLUMN_NAME='language';" || echo "")
  if [ "${IS_NULLABLE}" = "NO" ]; then
    echo "🔧  Migrating Thesaurus_Keywords.language to nullable…"
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
      -e "ALTER TABLE Thesaurus_Keywords MODIFY COLUMN language VARCHAR(20) NULL DEFAULT NULL;"
    echo "✅  Migration complete."
  fi
fi

# Clean up install files (optional)
rm -f /var/www/html/install.{php,html} || true

exec apache2-foreground
