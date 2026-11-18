<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Each section is only included when the staff member holds the permission behind it. */
class DashboardController extends Controller
{
    private const SETTLED = [OrderStatus::Paid, OrderStatus::Processing, OrderStatus::Shipped, OrderStatus::Delivered];

    public function __invoke(Request $request): JsonResponse
    {
        $staff = $request->user();
        $today = now()->startOfDay();

        $data = [
            'stats' => [
                'today_orders' => Order::whereIn('status', self::SETTLED)->where('paid_at', '>=', $today)->count(),
                'today_revenue_cents' => $staff->hasPermission('reports.view')
                    ? (int) Order::whereIn('status', self::SETTLED)->where('paid_at', '>=', $today)->sum('total_cents')
                    : null,
                'total_customers' => Customer::count(),
                'low_stock_count' => Product::active()->whereColumn('stock', '<=', 'low_stock_threshold')->count(),
                'pending_fulfilment' => Order::whereIn('status', [OrderStatus::Paid, OrderStatus::Processing])->count(),
            ],
        ];

        if ($staff->hasPermission('reports.view')) {
            $data['sales_chart'] = $this->salesChart();
        }

        if ($staff->hasPermission('orders.view')) {
            $data['recent_orders'] = OrderResource::collection(
                Order::with('customer:id,name,email,phone')->withCount('items')->latest('id')->limit(8)->get()
            );
        }

        if ($staff->hasPermission('products.view')) {
            $data['low_stock_products'] = Product::active()
                ->whereColumn('stock', '<=', 'low_stock_threshold')
                ->orderBy('stock')
                ->limit(5)
                ->get(['id', 'name', 'sku', 'stock', 'low_stock_threshold']);
        }

        return response()->json(['data' => $data]);
    }

    /** Daily revenue and order count for the last 30 days, with empty days filled in. */
    private function salesChart(): array
    {
        $from = now()->subDays(29)->startOfDay();

        $rows = Order::whereIn('status', self::SETTLED)
            ->where('paid_at', '>=', $from)
            ->selectRaw('DATE(paid_at) as day, COUNT(*) as orders, SUM(total_cents) as revenue')
            ->groupByRaw('DATE(paid_at)')
            ->get()
            ->keyBy('day');

        return collect(CarbonPeriod::create($from, now()->startOfDay()))->map(fn ($date) => [
            'date' => $date->toDateString(),
            'orders' => (int) ($rows[$date->toDateString()]->orders ?? 0),
            'revenue_cents' => (int) ($rows[$date->toDateString()]->revenue ?? 0),
        ])->values()->all();
    }
}
