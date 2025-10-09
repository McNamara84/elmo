FROM php:8.4-apache

# Install required packages and enable PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends mariadb-client \
        libxml2-dev \
        libxslt-dev \
        libzip-dev \
        dos2unix \
        nodejs \
        npm \
        git \
        unzip \
    && docker-php-ext-install \
        mysqli \
        pdo_mysql \
        xsl \
        zip \
    && rm -rf /var/lib/apt/lists/*

# Set Apache document root and enable rewrite module
ENV APACHE_DOCUMENT_ROOT=/var/www/html_1
RUN sed -i 's|/var/www/html|/var/www/html_1|g' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's|/var/www/html|/var/www/html_1|g' /etc/apache2/apache2.conf \
    && a2enmod rewrite

# Add directory permissions for the new document root
RUN echo '<Directory /var/www/html_1/>' >> /etc/apache2/apache2.conf \
    && echo '    Options Indexes FollowSymLinks' >> /etc/apache2/apache2.conf \
    && echo '    AllowOverride All' >> /etc/apache2/apache2.conf \
    && echo '    Require all granted' >> /etc/apache2/apache2.conf \
    && echo '</Directory>' >> /etc/apache2/apache2.conf

# Set the working directory for subsequent commands
WORKDIR /var/www/html_1

COPY . .

# Install Node dependencies
RUN npm install

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Install PHP dependencies
RUN composer install --no-dev --prefer-dist --optimize-autoloader

# Ensure that the standard user www-data has ownership of the application files
RUN chown -R www-data:www-data /var/www/html_1

# Install database schema and set entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh 
    
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]