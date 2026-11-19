<?php

return [
    // Where new uploads go: "local" (the public disk) or "cloudinary". Existing images keep working after a switch.
    'driver' => env('MEDIA_DRIVER', 'local'),

    'cloudinary' => [
        // cloudinary://<api_key>:<api_secret>@<cloud_name>, from the Cloudinary dashboard.
        'url' => env('CLOUDINARY_URL'),

        // Top-level folder, so several environments can share one Cloudinary account.
        'folder' => env('CLOUDINARY_FOLDER', 'nocfinity'),

        // Originals are capped at this size on upload; every size shown is derived from it on the CDN.
        'max_dimension' => (int) env('CLOUDINARY_MAX_DIMENSION', 2000),

        'timeout' => 30,
    ],
];
