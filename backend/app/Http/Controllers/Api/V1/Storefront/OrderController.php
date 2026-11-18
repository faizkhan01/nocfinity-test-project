<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\Orders\OrderLifecycle;
use App\Services\Orders\PaymentService;
use App\Services\Payments\PaymentGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** Every lookup goes through $request->user()->orders(), so customers can only reach their own orders. */
class OrderController extends Controller
{
    public function __construct(
        private readonly PaymentService $payments,
        private readonly OrderLifecycle $lifecycle,
        private readonly PaymentGateway $gateway,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['status' => ['nullable', Rule::enum(OrderStatus::class)]]);

        $orders = $request->user()->orders()
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['items.product:id,slug'])
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        return OrderResource::collection($orders);
    }

    public function show(Request $request, string $number): OrderResource
    {
        $order = $this->own($request, $number)->load(['items.product:id,slug', 'latestPayment', 'statusHistory']);

        return new OrderResource($order);
    }

    /** Called after Stripe.js confirms the card; the server checks the intent with Stripe itself. */
    public function confirmPayment(Request $request, string $number): OrderResource
    {
        $order = $this->payments->finalize($this->own($request, $number));

        return new OrderResource($order->load(['items.product:id,slug', 'latestPayment', 'statusHistory']));
    }

    /** Lets the customer retry a declined card on a still-pending order. */
    public function paymentIntent(Request $request, string $number): JsonResponse
    {
        $order = $this->own($request, $number);

        if ($order->status !== OrderStatus::Pending) {
            throw new ApiException('This order is no longer awaiting payment.', 'order_not_pending', 409);
        }

        $intent = $this->gateway->retrieve($order->latestPayment()->firstOrFail()->provider_payment_id);

        return response()->json(['data' => [
            'client_secret' => $intent->clientSecret,
            'publishable_key' => config('services.stripe.key'),
        ]]);
    }

    public function cancel(Request $request, string $number): OrderResource
    {
        $order = $this->own($request, $number);

        if (! in_array($order->status, [OrderStatus::Pending, OrderStatus::Paid], true)) {
            throw new ApiException('This order is already being prepared and can no longer be cancelled.', 'invalid_transition', 422);
        }

        $order = $this->lifecycle->cancel($order, 'Cancelled by customer');

        return new OrderResource($order->load(['items.product:id,slug', 'latestPayment', 'statusHistory']));
    }

    private function own(Request $request, string $number): Order
    {
        return $request->user()->orders()->where('order_number', $number)->firstOrFail();
    }
}
