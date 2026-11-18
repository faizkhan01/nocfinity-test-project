<?php

namespace App\Http\Middleware;

use App\Models\Staff;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: permission:products.create or permission:orders.view|orders.update_status (any of). */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permissions): Response
    {
        $staff = $request->user('admin');

        if (! $staff instanceof Staff) {
            throw new AuthorizationException;
        }

        foreach (explode('|', $permissions) as $permission) {
            if ($staff->hasPermission($permission)) {
                return $next($request);
            }
        }

        throw new AuthorizationException;
    }
}
