# Image for PHP 8.4
FROM php:8.4-apache

##
# Install required packages:
#   - libzip-dev and libxslt-dev for enabling ZIP and XSL in PHP
#   - libxml2-dev often needed for XSL
# Enable the extensions in PHP (zip, xsl, mysqli, pdo_mysql)
##
RUN apt-get update && \
    apt-get install -y \
        libzip-dev \
        libxslt-dev \
        libxml2-dev \
    && docker-php-ext-install \
        zip \
        xsl \
        mysqli \
        pdo_mysql \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Apache: .htaccess & Co.
ENV APACHE_DOCUMENT_ROOT=/var/www/html
RUN sed -i 's|/var/www/html|${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
 && a2enmod rewrite

##
# Copy the application files from ELMO into the container
##
COPY . /var/www/html/