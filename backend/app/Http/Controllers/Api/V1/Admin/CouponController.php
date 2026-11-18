<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CouponRequest;
use App\Models\Coupon;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    public function __construct(private readonly ActivityLogger $activity) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'expired'])],
        ]);

        $coupons = Coupon::query()
            ->when($request->filled('search'), fn ($q) => $q->where('code', 'like', '%'.addcslashes(strtoupper((string) $request->string('search')), '%_\\').'%'))
            ->when($request->input('status') === 'active', fn ($q) => $q->where('is_active', true)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now())))
            ->when($request->input('status') === 'inactive', fn ($q) => $q->where('is_active', false))
            ->when($request->input('status') === 'expired', fn ($q) => $q->where('expires_at', '<=', now()))
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        return response()->json([
            'data' => $coupons->getCollection()->map(fn (Coupon $c) => $this->present($c)),
            'meta' => ['current_page' => $coupons->currentPage(), 'last_page' => $coupons->lastPage(), 'per_page' => $coupons->perPage(), 'total' => $coupons->total()],
        ]);
    }

    public function store(CouponRequest $request): JsonResponse
    {
        $coupon = Coupon::create($request->validated());
        $this->activity->log('coupon.created', $coupon, ['code' => $coupon->code]);

        return response()->json(['data' => $this->present($coupon->fresh())], 201);
    }

    public function update(CouponRequest $request, Coupon $coupon): JsonResponse
    {
        $coupon->update($request->validated());
        $this->activity->log('coupon.updated', $coupon, ['code' => $coupon->code]);

        return response()->json(['data' => $this->present($coupon)]);
    }

    public function destroy(Coupon $coupon): Response
    {
        $coupon->delete();
        $this->activity->log('coupon.deleted', null, ['code' => $coupon->code]);

        return response()->noContent();
    }

    private function present(Coupon $coupon): array
    {
        return [
            ...$coupon->only('id', 'code', 'description', 'value', 'min_order_cents', 'max_discount_cents', 'usage_limit', 'per_user_limit', 'used_count', 'is_active'),
            'type' => $coupon->type->value,
            'starts_at' => $coupon->starts_at?->toIso8601String(),
            'expires_at' => $coupon->expires_at?->toIso8601String(),
            'is_expired' => $coupon->expires_at?->isPast() ?? false,
        ];
    }
}
