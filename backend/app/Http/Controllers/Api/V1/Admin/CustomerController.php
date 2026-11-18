<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        $customers = $this->withStats(Customer::query())
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.addcslashes((string) $request->string('search'), '%_\\').'%';
                $q->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term));
            })
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return response()->json([
            'data' => $customers->getCollection()->map(fn (Customer $c) => $this->present($c)),
            'meta' => ['current_page' => $customers->currentPage(), 'last_page' => $customers->lastPage(), 'per_page' => $customers->perPage(), 'total' => $customers->total()],
        ]);
    }

    public function show(Customer $customer): JsonResponse
    {
        $customer = $this->withStats(Customer::whereKey($customer->id))->firstOrFail();
        $orders = $customer->orders()->withCount('items')->latest('id')->paginate(10);

        return response()->json([
            'data' => [
                ...$this->present($customer),
                'orders' => OrderResource::collection($orders->getCollection()),
            ],
            'meta' => ['current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage(), 'total' => $orders->total()],
        ]);
    }

    private function withStats(Builder $query): Builder
    {
        $settled = fn ($q) => $q->whereNotIn('status', [OrderStatus::Pending, OrderStatus::Cancelled]);

        return $query->withCount(['orders', 'orders as paid_orders_count' => $settled])
            ->withSum(['orders as total_spent_cents' => $settled], 'total_cents');
    }

    private function present(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'is_active' => $customer->is_active,
            'email_verified' => $customer->email_verified_at !== null,
            'orders_count' => (int) $customer->orders_count,
            'paid_orders_count' => (int) $customer->paid_orders_count,
            'total_spent_cents' => (int) $customer->total_spent_cents,
            'last_login_at' => $customer->last_login_at?->toIso8601String(),
            'created_at' => $customer->created_at?->toIso8601String(),
        ];
    }
}
