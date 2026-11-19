#!/bin/sh
set -e

php artisan config:cache
php artisan route:cache
php artisan view:cache

# The worker role runs the queue and the scheduler; the web role migrates and serves HTTP.
if [ "$CONTAINER_ROLE" = "worker" ]; then
    # On shutdown, stop both loops and their PHP processes, letting the current job finish.
    trap 'trap "" TERM INT; kill -TERM 0 2>/dev/null; wait; exit 0' TERM INT
    # The platform only restarts a container that fails, so anything that stops is restarted here.
    keep_running() {
        while true; do
            "$@" &
            wait $! || sleep 5
        done
    }
    keep_running php artisan schedule:work &
    # queue:work exits cleanly every hour to stay fresh; auth emails (high) go before order emails and indexing (default).
    keep_running php artisan queue:work --queue=high,default --tries=3 --backoff=10 --max-time=3600
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
