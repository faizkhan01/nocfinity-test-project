<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    /** Target of the signed link in the verification email; redirects back to the storefront. */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $customer = Customer::findOrFail($id);

        abort_unless(hash_equals(sha1($customer->getEmailForVerification()), $hash), 403);

        if (! $customer->hasVerifiedEmail() && $customer->markEmailAsVerified()) {
            event(new Verified($customer));
        }

        return redirect()->away(config('app.frontend_url').'/account?verified=1');
    }

    public function resend(Request $request): JsonResponse
    {
        $customer = $request->user();

        if (! $customer->hasVerifiedEmail()) {
            $customer->sendEmailVerificationNotification();
        }

        return response()->json(['message' => 'Verification link sent.']);
    }
}
