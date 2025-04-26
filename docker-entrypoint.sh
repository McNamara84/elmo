#!/bin/sh
set -e

FLAG_FILE="/var/www/html/.installed"

wait_for_db() {
  echo "⏳  Waiting for MariaDB at $DB_HOST …"
  until mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" "$DB_NAME" >/dev/null 2>&1; do
    sleep 2
  done
  echo "✅  Database is reachable."
}

if [ ! -f "$FLAG_FILE" ]; then
  wait_for_db
  echo "🚀  Running initial database setup …"
  php /var/www/html/install.php "${INSTALL_ACTION:-basic}"
  touch "$FLAG_FILE"
  echo "🏁  Database setup finished."
fi

exec apache2-foreground
