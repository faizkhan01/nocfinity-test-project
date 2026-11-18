<?php

namespace Tests\Feature\Checkout;

use App\Enums\OrderStatus;
use App\Mail\OrderStatusUpdated;
use App\Models\Coupon;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Services\Payments\FakePaymentGateway;
use App\Services\Payments\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private FakePaymentGateway $gateway;

    private const SHIPPING = [
        'name' => 'Jane Doe', 'phone' => '+1 555 123 4567', 'line1' => '1 Main St',
        'city' => 'Springfield', 'postal_code' => '12345', 'country' => 'us',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->gateway = $this->app->make(PaymentGateway::class);
    }

    public function test_full_checkout_takes_stock_redeems_coupon_and_clears_cart(): void
    {
        $product = Product::factory()->create(['price_cents' => 10000, 'discount_price_cents' => 8000, 'stock' => 5]);
        $coupon = Coupon::factory()->create(['code' => 'TEN', 'value' => 10]);
        $this->actingAsCustomer();
        $this->addToCart($product, 2);
        $this->postJson('/api/v1/cart/coupon', ['code' => 'TEN'])->assertOk();

        $order = $this->checkout();
        $this->assertSame(16000, $order->subtotal_cents);
        $this->assertSame(1600, $order->discount_cents);
        $this->assertSame(1500, $order->shipping_cents);
        $this->assertSame(15900, $order->total_cents);
        $this->assertMatchesRegularExpression('/^ORD-\d{4}-\d{6}$/', $order->order_number);
        $this->assertSame(5, $product->fresh()->stock, 'Stock must not move before payment');

        $this->gateway->authorize($this->intentId($order));
        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")
            ->assertOk()->assertJsonPath('data.status', 'paid');

        $this->assertSame(3, $product->fresh()->stock);
        $this->assertSame(1, $coupon->fresh()->used_count);
        $this->assertSame('succeeded', $this->gateway->intents[$this->intentId($order)]->status);
        $this->getJson('/api/v1/cart')->assertJsonPath('data.item_count', 0);
        Mail::assertQueued(OrderStatusUpdated::class);
    }

    public function test_checkout_with_several_products_returns_every_line(): void
    {
        $this->actingAsCustomer();
        foreach (Product::factory()->count(3)->create(['stock' => 5]) as $product) {
            $this->addToCart($product, 1);
        }

        $this->postJson('/api/v1/checkout', ['shipping' => self::SHIPPING])
            ->assertCreated()
            ->assertJsonCount(3, 'data.order.items');
    }

    public function test_client_supplied_prices_and_totals_are_ignored(): void
    {
        $product = Product::factory()->create(['price_cents' => 5000, 'stock' => 5]);
        $this->actingAsCustomer();
        $this->postJson('/api/v1/cart/items', [
            'product_id' => $product->id, 'quantity' => 1, 'color' => 'Black', 'size' => 'Medium', 'price_cents' => 1,
        ])->assertOk();

        $response = $this->postJson('/api/v1/checkout', [
            'shipping' => self::SHIPPING, 'total_cents' => 1, 'subtotal_cents' => 1, 'discount_cents' => 4999,
        ])->assertCreated();

        $response->assertJsonPath('data.order.total_cents', 6500);
        $this->assertSame(6500, $this->gateway->intents[array_key_first($this->gateway->intents)]->amountCents);
    }

    public function test_stock_sold_out_during_payment_cancels_order_without_charging(): void
    {
        $product = Product::factory()->create(['stock' => 2]);
        $this->actingAsCustomer();
        $this->addToCart($product, 2);
        $order = $this->checkout();

        $product->update(['stock' => 1]);
        $this->gateway->authorize($this->intentId($order));

        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")
            ->assertStatus(409)->assertJsonPath('code', 'insufficient_stock');

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
        $this->assertSame(1, $product->fresh()->stock);
        $this->assertSame('canceled', $this->gateway->intents[$this->intentId($order)]->status, 'Authorization must be voided');
    }

    public function test_declined_card_leaves_order_unpaid_and_stock_untouched(): void
    {
        $product = Product::factory()->create(['stock' => 3]);
        $this->actingAsCustomer();
        $this->addToCart($product, 1);
        $order = $this->checkout();

        $this->gateway->decline($this->intentId($order), 'Your card was declined.');

        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")
            ->assertStatus(402)->assertJsonPath('code', 'payment_failed');

        $this->assertSame(OrderStatus::Pending, $order->fresh()->status);
        $this->assertNull($order->fresh()->paid_at);
        $this->assertSame(3, $product->fresh()->stock);
    }

    public function test_payment_amount_mismatch_is_rejected(): void
    {
        $product = Product::factory()->create(['stock' => 3]);
        $this->actingAsCustomer();
        $this->addToCart($product, 1);
        $order = $this->checkout();

        $this->gateway->authorize($this->intentId($order), amountCents: 100);

        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")
            ->assertStatus(409)->assertJsonPath('code', 'payment_mismatch');
        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
    }

    public function test_confirming_twice_does_not_take_stock_twice(): void
    {
        $product = Product::factory()->create(['stock' => 5]);
        $this->actingAsCustomer();
        $this->addToCart($product, 2);
        $order = $this->checkout();
        $this->gateway->authorize($this->intentId($order));

        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")->assertOk();
        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")->assertOk();

        $this->assertSame(3, $product->fresh()->stock);
    }

    public function test_out_of_stock_product_cannot_be_added_or_ordered(): void
    {
        $product = Product::factory()->outOfStock()->create();
        $this->actingAsCustomer();

        $this->postJson('/api/v1/cart/items', ['product_id' => $product->id, 'quantity' => 1, 'color' => 'Black', 'size' => 'Medium'])
            ->assertStatus(409)->assertJsonPath('code', 'insufficient_stock');

        $inStock = Product::factory()->create(['stock' => 1]);
        $this->addToCart($inStock, 1);
        $inStock->update(['stock' => 0]);

        $this->postJson('/api/v1/checkout', ['shipping' => self::SHIPPING])->assertStatus(409);
        $this->assertSame(0, Order::count());
    }

    public function test_expired_coupon_is_rejected_at_checkout(): void
    {
        $product = Product::factory()->create(['stock' => 5]);
        $coupon = Coupon::factory()->create(['code' => 'SOON']);
        $this->actingAsCustomer();
        $this->addToCart($product, 1);
        $this->postJson('/api/v1/cart/coupon', ['code' => 'SOON'])->assertOk();

        $coupon->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/v1/checkout', ['shipping' => self::SHIPPING])
            ->assertStatus(422)->assertJsonPath('code', 'coupon_invalid');
    }

    public function test_coupon_usage_limit_is_enforced_when_payment_is_finalized(): void
    {
        $coupon = Coupon::factory()->create(['code' => 'ONCE', 'usage_limit' => 1]);
        $product = Product::factory()->create(['stock' => 10]);

        $orders = [];
        foreach ([Customer::factory()->create(), Customer::factory()->create()] as $customer) {
            $this->actingAsCustomer($customer);
            $this->addToCart($product, 1);
            $this->postJson('/api/v1/cart/coupon', ['code' => 'ONCE'])->assertOk();
            $orders[] = [$customer, $this->checkout()];
        }

        foreach ($orders as $i => [$customer, $order]) {
            $this->actingAsCustomer($customer);
            $this->gateway->authorize($this->intentId($order));
            $response = $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment");
            $i === 0 ? $response->assertOk() : $response->assertStatus(422)->assertJsonPath('code', 'coupon_invalid');
        }

        $this->assertSame(1, $coupon->fresh()->used_count);
        $this->assertSame(9, $product->fresh()->stock);
    }

    public function test_cancelling_a_paid_order_restores_stock_and_refunds(): void
    {
        $product = Product::factory()->create(['stock' => 5]);
        $this->actingAsCustomer();
        $this->addToCart($product, 2);
        $order = $this->checkout();
        $this->gateway->authorize($this->intentId($order));
        $this->postJson("/api/v1/orders/{$order->order_number}/confirm-payment")->assertOk();

        $this->postJson("/api/v1/orders/{$order->order_number}/cancel")
            ->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->assertSame(5, $product->fresh()->stock);
        $this->assertContains($this->intentId($order), $this->gateway->refunded);
    }

    public function test_customers_cannot_see_each_others_orders(): void
    {
        $product = Product::factory()->create(['stock' => 5]);
        $this->actingAsCustomer();
        $this->addToCart($product, 1);
        $order = $this->checkout();

        $this->actingAsCustomer(Customer::factory()->create());
        $this->getJson("/api/v1/orders/{$order->order_number}")->assertNotFound();
        $this->postJson("/api/v1/orders/{$order->order_number}/cancel")->assertNotFound();
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_guests_cannot_check_out(): void
    {
        $this->postJson('/api/v1/checkout', ['shipping' => self::SHIPPING])->assertUnauthorized();
    }

    private function addToCart(Product $product, int $quantity): void
    {
        $this->postJson('/api/v1/cart/items', [
            'product_id' => $product->id, 'quantity' => $quantity, 'color' => 'Black', 'size' => 'Medium',
        ])->assertOk();
    }

    private function checkout(): Order
    {
        $number = $this->postJson('/api/v1/checkout', ['shipping' => self::SHIPPING])
            ->assertCreated()
            ->assertJsonStructure(['data' => ['order' => ['order_number'], 'payment' => ['client_secret']]])
            ->json('data.order.order_number');

        return Order::where('order_number', $number)->firstOrFail();
    }

    private function intentId(Order $order): string
    {
        return $order->latestPayment()->firstOrFail()->provider_payment_id;
    }
}
