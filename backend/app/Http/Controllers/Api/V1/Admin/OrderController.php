<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\Orders\OrderLifecycle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderLifecycle $lifecycle,
        private readonly ActivityLogger $activity,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(OrderStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'customer_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $orders = Order::with('customer:id,name,email')
            ->withCount('items')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('customer_id'), fn ($q) => $q->where('user_id', $request->integer('customer_id')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.addcslashes((string) $request->string('search'), '%_\\').'%';
                $q->where(fn ($q) => $q->where('order_number', 'like', $term)
                    ->orWhere('shipping_name', 'like', $term)
                    ->orWhereHas('customer', fn ($c) => $c->where('email', 'like', $term)->orWhere('name', 'like', $term)));
            })
            ->when($request->filled('date_from'), fn ($q) => $q->whereDate('created_at', '>=', $request->date('date_from')))
            ->when($request->filled('date_to'), fn ($q) => $q->whereDate('created_at', '<=', $request->date('date_to')))
            ->latest('id')
            ->paginate($request->integer('per_page', 15))
            ->withQueryString();

        return OrderResource::collection($orders);
    }

    public function show(Order $order): OrderResource
    {
        return new OrderResource($order->load(['items.product:id,slug', 'customer', 'latestPayment', 'statusHistory.changedBy:id,name']));
    }

    public function updateStatus(Request $request, Order $order): OrderResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::enum(OrderStatus::class)],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $from = $order->status;
        $order = $this->lifecycle->transitionByStaff($order, OrderStatus::from($data['status']), $request->user(), $data['note'] ?? null);
        $this->activity->log('order.status_changed', $order, ['from' => $from->value, 'to' => $order->status->value]);

        return $this->show($order);
    }
}
