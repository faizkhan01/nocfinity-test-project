#!/bin/sh
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache

# The worker role runs the queue and the scheduler; the web role migrates and serves HTTP.
if [ "$CONTAINER_ROLE" = "worker" ]; then
    php artisan schedule:work &
    exec php artisan queue:work --tries=3 --backoff=10 --max-time=3600
fi

php artisan migrate --force
[ "$(php artisan app:is-seeded)" = "yes" ] || php artisan db:seed --force
php artisan storage:link > /dev/null 2>&1 || true

export SERVER_NAME=":${PORT:-8080}"
exec frankenphp run --config /etc/caddy/Caddyfile
