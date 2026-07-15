FROM php:8.5-apache

# Install Node.js 24 from NodeSource
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install required packages and enable PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends mariadb-client \
        libxml2-dev \
        libxslt-dev \
        libzip-dev \
        dos2unix \
        git \
        unzip \
    && docker-php-ext-install \
        mysqli \
        pdo_mysql \
        xsl \
        zip \
    && rm -rf /var/lib/apt/lists/*

# Set Apache document root and enable rewrite module
ENV APACHE_DOCUMENT_ROOT=/var/www/html
RUN sed -i 's|/var/www/html|${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
    && a2enmod rewrite \
    && a2enmod deflate \
    && a2enmod headers \
    && a2enmod expires

# Copy custom Apache GZIP compression configuration
COPY docker/apache-gzip.conf /etc/apache2/conf-available/gzip.conf
RUN a2enconf gzip

# Set the working directory for subsequent commands
WORKDIR /var/www/html

COPY . .

# Install production Node dependencies from the lockfile
RUN npm ci --omit=dev

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Install PHP dependencies
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader

# Ensure that the standard user www-data has ownership of the application files
RUN chown -R www-data:www-data /var/www/html

# Install database schema and set entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh 
    
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]