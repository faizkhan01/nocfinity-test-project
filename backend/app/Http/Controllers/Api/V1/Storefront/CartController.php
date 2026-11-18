<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Resources\CartResource;
use App\Models\Cart;
use App\Services\Checkout\CartService;
use App\Services\Checkout\PricingService;
use Illuminate\Http\Request;

/** Works for guests (X-Cart-Token header) and signed-in customers (bearer token). */
class CartController extends Controller
{
    public function __construct(
        private readonly CartService $carts,
        private readonly PricingService $pricing,
    ) {}

    public function show(Request $request): CartResource
    {
        return $this->respond($request, $this->cart($request));
    }

    public function addItem(Request $request): CartResource
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.config('shop.max_quantity_per_item')],
            'color' => ['nullable', 'string', 'max:40'],
            'size' => ['nullable', 'string', 'max:20'],
        ]);

        $cart = $this->cart($request, create: true);
        $this->carts->addItem($cart, $data['product_id'], $data['quantity'], $data['color'] ?? null, $data['size'] ?? null);

        return $this->respond($request, $cart);
    }

    public function updateItem(Request $request, int $item): CartResource
    {
        $data = $request->validate(['quantity' => ['required', 'integer', 'min:1', 'max:'.config('shop.max_quantity_per_item')]]);

        $cart = $this->cartOrFail($request);
        $this->carts->updateItem($cart, $item, $data['quantity']);

        return $this->respond($request, $cart);
    }

    public function removeItem(Request $request, int $item): CartResource
    {
        $cart = $this->cartOrFail($request);
        $this->carts->removeItem($cart, $item);

        return $this->respond($request, $cart);
    }

    public function applyCoupon(Request $request): CartResource
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:40']]);

        $cart = $this->cartOrFail($request);
        $this->carts->applyCoupon($cart, $data['code'], $request->user('customer'));

        return $this->respond($request, $cart);
    }

    public function removeCoupon(Request $request): CartResource
    {
        $cart = $this->cartOrFail($request);
        $this->carts->removeCoupon($cart);

        return $this->respond($request, $cart);
    }

    private function cart(Request $request, bool $create = false): ?Cart
    {
        return $this->carts->resolve($request->user('customer'), $request->header('X-Cart-Token'), $create);
    }

    private function cartOrFail(Request $request): Cart
    {
        return $this->cart($request) ?? abort(404);
    }

    private function respond(Request $request, ?Cart $cart): CartResource
    {
        $cart = $cart?->fresh();

        return new CartResource($cart, $cart ? $this->pricing->quote($cart, $request->user('customer')) : null);
    }
}
