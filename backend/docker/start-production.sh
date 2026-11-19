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
php artisan app:publish-seed-images

# Images still on the volume move to Cloudinary; a no-op once everything is there.
if [ "$MEDIA_DRIVER" = "cloudinary" ]; then
    php artisan app:move-media-to-cloudinary || echo "Image move to Cloudinary did not finish; it retries on the next boot."
fi

# Break-glass: set RESET_TWO_FACTOR_FOR=<email> for one deploy, then remove it.
if [ -n "$RESET_TWO_FACTOR_FOR" ]; then
    php artisan app:reset-two-factor "$RESET_TWO_FACTOR_FOR" --list
fi

if [ "$SCOUT_DRIVER" = "meilisearch" ]; then
    php artisan scout:sync-index-settings && php artisan scout:import "App\\Models\\Product" || echo "Search index not ready; product search falls back to the database."
fi

export SERVER_NAME=":${PORT:-8080}"
exec frankenphp run --config /etc/caddy/Caddyfile
