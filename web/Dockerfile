FROM php:8.5-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/* \
 && docker-php-ext-install pdo_mysql \
 && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php.ini $PHP_INI_DIR/conf.d/zz-creativeart.ini

# Pakkene ligger utenfor /app/web, slik at de ikke skjules når koden monteres inn.
ENV COMPOSER_VENDOR_DIR=/opt/vendor \
    COMPOSER_ALLOW_SUPERUSER=1 \
    PATH="/opt/vendor/bin:${PATH}"

WORKDIR /app/web
COPY composer.json composer.lock* ./
RUN composer install --no-interaction --no-progress

COPY . .
