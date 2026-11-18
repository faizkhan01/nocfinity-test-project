<?php

namespace App\Services\Orders;

use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Collection;

/** Must be called inside a DB transaction: rows are locked until it commits. */
class StockService
{
    /** Lock every product in the order (in id order, to avoid deadlocks) and take the stock. */
    public function decrementFor(Order $order): void
    {
        $products = $this->lockProducts($order);
        $errors = [];

        foreach ($order->items as $item) {
            $product = $products->get($item->product_id);

            if (! $product || ! $product->is_active || $product->trashed()) {
                $errors["items.{$item->product_id}"] = ["{$item->product_name} is no longer available."];
            } elseif ($product->stock < $item->quantity) {
                $errors["items.{$item->product_id}"] = [$product->stock === 0
                    ? "{$item->product_name} sold out while you were paying."
                    : "Only {$product->stock} of {$item->product_name} left in stock."];
            }
        }

        if ($errors) {
            throw new InsufficientStockException(
                'Some items in your order are no longer available in the requested quantity. You have not been charged.',
                $errors,
            );
        }

        foreach ($order->items as $item) {
            $product = $products->get($item->product_id);
            $product->decrement('stock', $item->quantity);
            $product->increment('sold_count', $item->quantity);
        }
    }

    public function restoreFor(Order $order): void
    {
        $products = $this->lockProducts($order);

        foreach ($order->items as $item) {
            $product = $products->get($item->product_id);

            if ($product) {
                $product->increment('stock', $item->quantity);
                $product->sold_count >= $item->quantity && $product->decrement('sold_count', $item->quantity);
            }
        }
    }

    /** @return Collection<int, Product> */
    private function lockProducts(Order $order): Collection
    {
        $ids = $order->items->pluck('product_id')->filter()->unique()->sort()->values();

        return Product::withTrashed()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
    }
}
