#!/bin/sh
set -e

FLAG_FILE="/var/www/html/.installed"
LOG_PREFIX="[ELMO-DEPLOYMENT]"

# Enhanced logging function
log() {
    echo "$LOG_PREFIX $1"
}

# give www-data ownership of the xml folder every start
chown -R www-data:www-data /var/www/html/xml

wait_for_db() {
    log "🔄 Waiting for database connection..."
    php -r '
    $max = 30;
    $attempt = 1;
    while ($max--) {
        echo "[ELMO-DEPLOYMENT] Attempt $attempt/30: Connecting to " . getenv("DB_HOST") . "...\n";
        @$c = new mysqli(getenv("DB_HOST"), getenv("DB_USER"), getenv("DB_PASSWORD"));
        if (!$c->connect_errno) { 
            echo "[ELMO-DEPLOYMENT] ✅ MariaDB connection successful\n"; 
            exit(0); 
        }
        echo "[ELMO-DEPLOYMENT] ❌ Connection failed: " . $c->connect_error . "\n";
        $attempt++;
        sleep(2);
    }
    echo "[ELMO-DEPLOYMENT] ❌ MariaDB not reachable after 30 attempts\n"; 
    exit(1);
    ' || exit 1
}

check_database_schema() {
    log "🔍 Checking database schema..."
    php -r '
    $c = new mysqli(getenv("DB_HOST"), getenv("DB_USER"), getenv("DB_PASSWORD"), getenv("DB_NAME"));
    if ($c->connect_errno) { exit(1); }
    $result = $c->query("SHOW TABLES LIKE \"Resource\"");
    if ($result && $result->num_rows > 0) {
        echo "[ELMO-DEPLOYMENT] ✅ Database schema exists\n";
        exit(0);
    } else {
        echo "[ELMO-DEPLOYMENT] ⚠️  Database schema missing\n";
        exit(1);
    }
    ' && return 0 || return 1
}

run_installation() {
    local install_action="${INSTALL_ACTION:-complete}"
    log "🚀 Running database setup with action: $install_action"
    
    if php /var/www/html/install.php "$install_action"; then
        log "✅ Database setup completed successfully"
        touch "$FLAG_FILE"
        
        # Clean up install files after successful installation
        if [ -f /var/www/html/install.php ]; then
            log "🧹 Cleaning up installation files..."
            rm -f /var/www/html/install.{php,html}
            log "✅ Installation files cleaned up"
        fi
        
        return 0
    else
        log "❌ Database setup failed"
        return 1
    fi
}

report_deployment_status() {
    log "📊 DEPLOYMENT STATUS REPORT"
    log "=========================="
    log "Container: ELMO Web Application"
    log "Environment: ${ENVIRONMENT:-production}"
    log "Install Action: ${INSTALL_ACTION:-complete}"
    log "Database Host: ${DB_HOST:-localhost}"
    log "Database Name: ${DB_NAME:-not_set}"
    log "Flag File: $FLAG_FILE"
    
    if [ -f "$FLAG_FILE" ]; then
        log "Installation Status: ✅ COMPLETED"
        log "Installed at: $(stat -c %y "$FLAG_FILE" 2>/dev/null || date)"
    else
        log "Installation Status: ⚠️  PENDING"
    fi
    
    # Check if critical files exist
    if [ -f /var/www/html/index.php ]; then
        log "Application Files: ✅ PRESENT"
    else
        log "Application Files: ❌ MISSING"
    fi
    
    # Check environment configuration
    if [ -n "${apiKeyElmo}" ]; then
        log "API Configuration: ✅ CONFIGURED"
    else
        log "API Configuration: ⚠️  DEFAULT VALUES"
    fi
    
    log "=========================="
}

# Main execution flow
log "🐳 Starting ELMO container initialization..."

# Always wait for database
wait_for_db

# Report initial status
report_deployment_status

# Check if we need to run installation
if [ ! -f "$FLAG_FILE" ]; then
    log "📦 First-time setup detected"
    if ! check_database_schema; then
        run_installation
    else
        log "ℹ️  Database schema exists, skipping installation"
        touch "$FLAG_FILE"
    fi
else
    log "♻️  Container restart detected, skipping installation"
fi

# Final status report
report_deployment_status
log "🎯 Starting Apache web server..."

# Start Apache
exec apache2-foreground