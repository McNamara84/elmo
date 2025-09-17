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

# Ensure a helper-functions.php exists; in production create it from settings.elmo.php,
# so that local helper-functions.php (dev) is not needed/overwritten.
if [ ! -f /var/www/html/helper-functions.php ]; then
  echo "⚙️  No helper-functions.php found, creating from settings.elmo.php"
  cp /var/www/html/settings.elmo.php /var/www/html/helper-functions.php
  chown www-data:www-data /var/www/html/helper-functions.php
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
if [ -f /var/www/html/.env ] && [ "$(stat -c %s /var/www/html/.env)" -gt 0 ]; then
  echo "🔧 Using mounted .env file"
else
  # Copy the appropriate .env file based on CONFIG_VERSION
  # CONFIG_VERSION determines which configuration to use.
  case "${CONFIG_VERSION}" in
  "generic"|"")
    echo "🔧 Using generic.env configuration"
    cp /var/www/html/envs/generic.env /var/www/html/.env
    ;;
  "msl")
    echo "🔧 Using msl.env configuration"
    cp /var/www/html/envs/msl.env /var/www/html/.env
    ;;
  "elmogem")
    echo "🔧 Using elmogem.env configuration"
    cp /var/www/html/envs/elmogem.env /var/www/html/.env
    ;;
  "testing")
    echo "🔧 Using testing.env configuration"
    cp /var/www/html/envs/testing.env /var/www/html/.env
    ;;
  *)
    echo "❌ Invalid CONFIG_VERSION specified. Allowed values: 'generic', 'msl', 'elmogem' or 'testing'."
    exit 1
    ;;
esac

wait_for_db

# Only run installer when allowed AND schema is empty
if [ "${INSTALL_ACTION:-skip}" != "skip" ]; then
  if db_has_tables; then
    echo "📚  Database schema for '${DB_NAME}' already present — skipping install."
  else
    echo "🚀  Running initial database setup (${INSTALL_ACTION:-complete})…"
    php /var/www/html/install.php "${INSTALL_ACTION:-complete}" # complete|basic
    echo "🏁  Database setup finished."
  fi
else
  echo "⏭️  INSTALL_ACTION=skip — no install attempt."
fi

# Clean up install files (optional)
rm -f /var/www/html/install.{php,html} || true

exec apache2-foreground