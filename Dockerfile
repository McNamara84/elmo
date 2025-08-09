# Stage 1: Build dependencies
FROM php:8.4-cli AS builder

# Install build tools
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /build

# Copy dependency files
COPY composer.json composer.lock* package.json package-lock.json* ./

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Install Node dependencies
RUN npm ci --only=production

# Stage 2: Production image
FROM php:8.4-apache

# Install required packages and enable PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
        mariadb-client \
        libxml2-dev \
        libxslt-dev \
        libzip-dev \
        dos2unix \
    && docker-php-ext-install \
        mysqli \
        pdo_mysql \
        xsl \
        zip \
    && rm -rf /var/lib/apt/lists/*

# Set Apache document root and enable rewrite module
ENV APACHE_DOCUMENT_ROOT=/var/www/html
RUN sed -i 's|/var/www/html|${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
    && a2enmod rewrite

WORKDIR /var/www/html

# Copy application files
COPY . .

# Copy dependencies from builder stage
COPY --from=builder /build/vendor ./vendor
COPY --from=builder /build/node_modules ./node_modules

# Create settings.php from sample if it doesn't exist
RUN if [ ! -f settings.php ]; then cp sample_settings.php settings.php; fi

# Ensure that the standard user www-data has ownership of the application files
RUN chown -R www-data:www-data /var/www/html

# Install database schema and set entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh 
    
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]