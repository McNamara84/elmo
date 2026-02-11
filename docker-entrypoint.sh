#!/bin/sh
set -e

# give www-data ownership of the xml folder every start
chown -R www-data:www-data /var/www/html/xml

# Ensure PHP dependencies are installed
if [ ! -d /var/www/html/vendor ]; then
  echo "📦  Installing PHP dependencies with Composer"
  composer install --no-dev --prefer-dist --optimize-autoloader
fi

# Node dependencies are bundled into assets/vendor during build.

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

# Wait for the DB using PHP mysqli (no DB client needed)
wait_for_db() {
  echo "⏳  Waiting for MariaDB at ${DB_HOST}..."
  php -r '
$host = getenv("DB_HOST");
$user = getenv("DB_USER");
$pass = getenv("DB_PASSWORD");
$max = 60;
$i = 0;
while ($i < $max) {
  $mysqli = @new mysqli($host, $user, $pass);
  if ($mysqli && $mysqli->connect_errno === 0) {
    $mysqli->close();
    exit(0);
  }
  echo "… still waiting\n";
  sleep(2);
  $i++;
}
exit(1);
'
  echo "✅  MariaDB reachable"
}

# Check if tables already exist in the target schema
db_has_tables() {
  TABLE_COUNT=$(php -r '
$host = getenv("DB_HOST");
$user = getenv("DB_USER");
$pass = getenv("DB_PASSWORD");
$db = getenv("DB_NAME");
$mysqli = @new mysqli($host, $user, $pass, $db);
if (!$mysqli || $mysqli->connect_errno !== 0) {
  echo "0";
  exit(0);
}
$result = $mysqli->query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema='" . $mysqli->real_escape_string($db) . "';");
if (!$result) {
  echo "0";
  exit(0);
}
$row = $result->fetch_assoc();
echo $row["cnt"] ?? "0";
');
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

# Clean up install files (optional)
rm -f /var/www/html/install.{php,html} || true

# Start PHP-FPM
exec php-fpm -F
