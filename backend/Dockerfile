FROM php:8.4-fpm-alpine

COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_mysql bcmath intl zip gd exif pcntl opcache
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

RUN apk add --no-cache mysql-client \
    && echo "upload_max_filesize=10M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size=60M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "expose_php=Off" > /usr/local/etc/php/conf.d/security.ini

WORKDIR /var/www/html
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]
