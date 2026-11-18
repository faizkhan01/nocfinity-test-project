<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NewsletterController extends Controller
{
    /** Idempotent: subscribing twice returns the same response, so it cannot be used to probe the list. */
    public function __invoke(Request $request): JsonResponse
    {
        $email = strtolower(trim((string) $request->validate(['email' => ['required', 'string', 'email:rfc', 'max:255']])['email']));

        DB::table('newsletter_subscribers')->insertOrIgnore([
            'email' => $email,
            'ip_address' => $request->ip(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Subscribed.'], 201);
    }
}
