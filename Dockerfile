FROM node:24-alpine AS node-builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM php:8.5-fpm-alpine AS builder

RUN apk add --no-cache git unzip

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Set the working directory for subsequent commands
WORKDIR /var/www/html

COPY . .

# Install PHP dependencies
RUN composer install --no-dev --prefer-dist --optimize-autoloader

# Copy Node dependencies from node builder
COPY --from=node-builder /app/node_modules /var/www/html/node_modules

# Create runtime vendor assets and remove node_modules from runtime image later
RUN mkdir -p /var/www/html/assets/vendor \
    && cp -R /var/www/html/node_modules/bootstrap/dist /var/www/html/assets/vendor/bootstrap \
    && cp -R /var/www/html/node_modules/jquery/dist /var/www/html/assets/vendor/jquery \
    && cp -R /var/www/html/node_modules/jquery-ui/dist /var/www/html/assets/vendor/jquery-ui \
    && cp -R /var/www/html/node_modules/bootstrap-icons/font /var/www/html/assets/vendor/bootstrap-icons \
    && cp -R /var/www/html/node_modules/@yaireo/tagify/dist /var/www/html/assets/vendor/tagify \
    && cp -R /var/www/html/node_modules/jstree/dist /var/www/html/assets/vendor/jstree \
    && cp -R /var/www/html/node_modules/mark.js/dist /var/www/html/assets/vendor/markjs

FROM php:8.5-fpm-alpine AS runtime

# Install required packages and enable PHP extensions
RUN apk add --no-cache \
        mariadb-client \
        nginx \
        dos2unix \
        libxml2 \
        libxslt \
        libzip \
    && apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        libxml2-dev \
        libxslt-dev \
        libzip-dev \
    && docker-php-ext-install \
        mysqli \
        pdo_mysql \
        xsl \
        zip \
    && apk del .build-deps

# Configure Nginx
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Set the working directory for subsequent commands
WORKDIR /var/www/html

COPY --from=builder /var/www/html /var/www/html

# Ensure that the standard user www-data has ownership of the application files
RUN chown -R www-data:www-data /var/www/html

# Remove test artifacts from runtime image
RUN rm -rf /var/www/html/tests /var/www/html/phpunit.xml /var/www/html/node_modules

# Install database schema and set entrypoint
COPY docker-entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh 
    
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

FROM builder AS test

RUN apk add --no-cache nodejs npm

# Install dev PHP dependencies for tests
RUN composer install --prefer-dist --optimize-autoloader

# Install Node dependencies including dev dependencies for tests
RUN npm install