FROM php:8.4-apache

# Install required packages and enable PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends mariadb-client \
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

# Install Composer globally. 
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
# Set a working directory
WORKDIR /var/www/html

# Copy composer files and install dependencies
# This is done separately to leverage Docker cache
COPY composer.json composer.lock ./
RUN composer install --no-interaction --no-plugins --no-scripts --prefer-dist

# Copy the application files
COPY . .
# Ensure that the standard user www-data has ownership of the application files
RUN chown -R www-data:www-data /var/www/html

# Install database schema and set entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh 
    
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]