#!/bin/sh
set -e

# Only the main app container prepares code and database; workers wait on its healthcheck.
if [ "$CONTAINER_ROLE" = "app" ]; then
    rm -f storage/framework/.ready
    [ -f .env ] || cp .env.example .env
    [ -d vendor ] || composer install --no-interaction --prefer-dist
    grep -q '^APP_KEY=base64' .env || php artisan key:generate --force

    until php artisan db:monitor --databases=mysql > /dev/null 2>&1; do
        echo "Waiting for MySQL..."; sleep 2
    done

    php artisan migrate --force
    [ "$(php artisan app:is-seeded)" = "yes" ] || php artisan db:seed --force
    php artisan storage:link > /dev/null 2>&1 || true

    if [ "${SCOUT_DRIVER:-$(grep -E '^SCOUT_DRIVER=' .env | cut -d= -f2)}" = "meilisearch" ]; then
        php artisan scout:sync-index-settings && php artisan scout:import "App\\Models\\Product" || echo "Search index not ready; product search falls back to the database."
    fi
    touch storage/framework/.ready
fi

exec "$@"
