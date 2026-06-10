# syntax=docker/dockerfile:1.7

# Stage 1: base
# Uses php:8.5-apache (Debian-based with Apache bundled) and defines
# all shared system/PHP runtime capabilities for dev + prod alignment.
FROM php:8.5-apache AS base

ARG DEBIAN_FRONTEND=noninteractive

# Build and runtime libs needed for PHP extensions and DB connectivity.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        git \
        unzip \
        mariadb-client \
        libxml2-dev \
        libxslt-dev \
        libzip-dev \
    && docker-php-ext-install -j"$(nproc)" \
        mysqli \
        pdo_mysql \
        xsl \
        zip \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html

# Keep existing Apache behavior used by the application.
RUN sed -ri "s!/var/www/html!${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/000-default.conf \
    && a2enmod rewrite deflate headers expires

COPY docker/apache-gzip.conf /etc/apache2/conf-available/gzip.conf
RUN a2enconf gzip

WORKDIR /var/www/html

# Stage 2: dev
# Inherits from base and runs as root for local bind-mount workflows.
FROM base AS dev

USER root
ARG DEBIAN_FRONTEND=noninteractive

# Install Node.js 24 in the dev-aligned environment.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Composer directly into the image.
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Install dependencies early for better build cache behavior.
COPY composer.json composer.lock package.json package-lock.json ./
RUN composer install --prefer-dist --no-interaction \
    && npm install

# Stage 3: builder
# Strictly inherits from dev so prod artifacts are built in the same env.
FROM dev AS builder

WORKDIR /var/www/html
COPY . .

# Build production dependency sets.
RUN composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction \
    && npm install --omit=dev

# Stage 4: prod
# Strictly inherits from base for a smaller runtime image.
FROM base AS prod

ARG DEBIAN_FRONTEND=noninteractive

# Remove build-only development headers while keeping runtime libraries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libxml2 \
        libxslt1.1 \
        libzip4 \
    && apt-get purge -y \
        libxml2-dev \
        libxslt-dev \
        libzip-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# Copy the fully prepared application tree plus production dependencies.
COPY --from=builder --chown=www-data:www-data /var/www/html /var/www/html

COPY --chown=www-data:www-data docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Apache binds :80 as root and serves requests with www-data workers.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]