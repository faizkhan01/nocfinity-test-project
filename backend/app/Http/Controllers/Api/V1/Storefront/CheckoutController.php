<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Requests\Checkout\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\Orders\CheckoutService;
use Illuminate\Http\JsonResponse;

class CheckoutController extends Controller
{
    public function __construct(private readonly CheckoutService $checkout) {}

    /** Any price, total or discount in the request body is ignored; everything is recomputed from the cart. */
    public function store(CheckoutRequest $request): JsonResponse
    {
        ['order' => $order, 'intent' => $intent] = $this->checkout->start(
            $request->user(), $request->shipping(), $request->validated('notes'),
        );

        return response()->json([
            'data' => [
                'order' => new OrderResource($order->load('items.product:id,slug')),
                'payment' => [
                    'client_secret' => $intent->clientSecret,
                    'publishable_key' => config('services.stripe.key'),
                ],
            ],
        ], 201);
    }
}
