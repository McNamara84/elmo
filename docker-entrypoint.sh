#!/bin/sh
set -e

FLAG_FILE="/var/www/html/.installed"

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

# Ensure a settings.php exists
if [ ! -f /var/www/html/settings.php ]; then
  echo "⚙️  No settings.php found, creating from settings.elmo.php"
  cp /var/www/html/settings.elmo.php /var/www/html/settings.php
  chown www-data:www-data /var/www/html/settings.php
fi

wait_for_db() {
  php -r '
  while (true) {
      try {
          new mysqli(getenv("DB_HOST"), getenv("DB_USER"), getenv("DB_PASSWORD"), getenv("DB_NAME"));
          echo "✅  MariaDB reachable\n";
          exit(0);
      } catch (mysqli_sql_exception $e) {
          if ($e->getCode() === 1045) {
              fwrite(STDERR, "❌  MariaDB access denied: {$e->getMessage()}\n");
              exit(1);
          }
          echo "⏳  Waiting for MariaDB: {$e->getMessage()}\n";
          sleep(2);
      }
  }
  ' || exit 1
}

# Install only if INSTALL_ACTION != skip
if [ "${INSTALL_ACTION:-skip}" != "skip" ] && [ ! -f "$FLAG_FILE" ]; then
  wait_for_db
  echo "🚀  Running initial database setup …"
  php /var/www/html/install.php "${INSTALL_ACTION:-complete}" # can be set to complete or basic
  touch "$FLAG_FILE"
  echo "🏁  Database setup finished."
fi

# Clean up install files
rm -f /var/www/html/install.{php,html}

exec apache2-foreground
