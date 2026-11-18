<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => Customer::factory(),
            'subtotal_cents' => 10000,
            'shipping_cents' => 1500,
            'total_cents' => 11500,
            'currency' => 'USD',
            'shipping_name' => fake()->name(),
            'shipping_phone' => '+1 555 000 1111',
            'shipping_line1' => fake()->streetAddress(),
            'shipping_city' => fake()->city(),
            'shipping_postal_code' => '12345',
            'shipping_country' => 'US',
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (Order $order) {
            $order->status ??= OrderStatus::Pending;
        })->afterCreating(function (Order $order) {
            $order->order_number = Order::numberFor($order);
            $order->save();
        });
    }
}
