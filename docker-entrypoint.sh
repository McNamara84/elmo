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

# Ensure a settings.php exists; in Produktion aus settings.elmo.php erzeugen,
# damit lokale settings.php (dev) nicht benötigt/überschrieben wird.
if [ ! -f /var/www/html/settings.php ]; then
  echo "⚙️  No settings.php found, creating from settings.elmo.php"
  cp /var/www/html/settings.elmo.php /var/www/html/settings.php
  chown www-data:www-data /var/www/html/settings.php
fi

# Warten auf die DB per mysqladmin ping (zuverlässiger)
wait_for_db() {
  echo "⏳  Waiting for MariaDB at ${DB_HOST}..."
  until mysqladmin ping -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" --silent >/dev/null 2>&1; do
    echo "… still waiting"
    sleep 2
  done
  echo "✅  MariaDB reachable"
}

# Prüfen, ob im Ziel-Schema bereits Tabellen existieren
db_has_tables() {
  TABLE_COUNT=$(mysql -N -s -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")
  if [ -z "${TABLE_COUNT}" ]; then
    TABLE_COUNT=0
  fi
  [ "${TABLE_COUNT}" -gt 0 ]
}

wait_for_db

# Installer nur ausführen, wenn erlaubt UND Schema leer
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
