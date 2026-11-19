<?php

namespace Tests\Feature\Checkout;

use App\Enums\OrderStatus;
use App\Mail\OrderStatusUpdated;
use App\Models\Order;
use App\Models\Product;
use App\Models\StripeEvent;
use App\Services\Payments\FakePaymentGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentIntentData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

class PaymentReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_test_secret';

    private FakePaymentGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['services.stripe.webhook_secret' => self::SECRET]);
        $this->gateway = $this->app->make(PaymentGateway::class);
    }

    public function test_a_payment_authorized_after_the_browser_closed_is_completed_by_the_reconciler(): void
    {
        $product = Product::factory()->create(['stock' => 5]);
        $order = $this->placeOrder($product, 2);
        $this->gateway->authorize($this->intentId($order));

        $this->travel(4)->minutes();
        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame(OrderStatus::Pending, $order->fresh()->status, 'Too recent: the browser may still confirm it');

        $this->travel(2)->minutes();
        $this->artisan('payments:reconcile')->expectsOutputToContain("{$order->order_number}: finalized")->assertSuccessful();

        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
        $this->assertSame(3, $product->fresh()->stock);
        $this->assertSame('succeeded', $this->gateway->intents[$this->intentId($order)]->status, 'The authorization was captured');
        Mail::assertQueued(OrderStatusUpdated::class);
    }

    public function test_an_authorized_payment_is_never_voided_by_expiry(): void
    {
        $order = $this->placeOrder(Product::factory()->create(['stock' => 5]));
        $this->gateway->authorize($this->intentId($order));

        $this->travel(3)->hours();
        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
    }

    public function test_an_unpaid_order_waits_until_its_time_runs_out_and_is_then_voided(): void
    {
        $order = $this->placeOrder(Product::factory()->create(['stock' => 5]));

        $this->travel(30)->minutes();
        $this->artisan('payments:reconcile')->assertSuccessful();
        $this->assertSame(OrderStatus::Pending, $order->fresh()->status);

        $this->travel(31)->minutes();
        $this->artisan('payments:reconcile')->expectsOutputToContain("{$order->order_number}: expired")->assertSuccessful();

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
        $this->assertSame('canceled', $this->gateway->intents[$this->intentId($order)]->status);
    }

    public function test_a_payment_still_processing_at_stripe_is_left_alone_even_after_the_time_limit(): void
    {
        $order = $this->placeOrder(Product::factory()->create(['stock' => 5]));
        $id = $this->intentId($order);
        $this->gateway->intents[$id] = new PaymentIntentData($id, 'processing', $order->total_cents, 'usd', $order->id);

        $this->travel(2)->hours();
        $this->artisan('payments:reconcile')->assertSuccessful();

        $this->assertSame(OrderStatus::Pending, $order->fresh()->status);
    }

    public function test_an_authorized_payment_for_stock_that_sold_out_is_voided_not_charged(): void
    {
        $product = Product::factory()->create(['stock' => 1]);
        $order = $this->placeOrder($product);
        $this->gateway->authorize($this->intentId($order));
        $product->update(['stock' => 0]);

        $this->travel(6)->minutes();
        $this->artisan('payments:reconcile')->expectsOutputToContain('rejected:insufficient_stock')->assertSuccessful();

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
        $this->assertSame('canceled', $this->gateway->intents[$this->intentId($order)]->status);
    }

    public function test_a_payment_cancelled_at_stripe_cancels_the_order(): void
    {
        $order = $this->placeOrder(Product::factory()->create(['stock' => 5]));
        $this->gateway->cancel($this->intentId($order));

        $this->travel(6)->minutes();
        $this->artisan('payments:reconcile')->expectsOutputToContain("{$order->order_number}: cancelled")->assertSuccessful();

        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
    }

    public function test_one_failing_order_does_not_stop_the_others(): void
    {
        $broken = $this->placeOrder(Product::factory()->create(['stock' => 5]));
        $healthy = $this->placeOrder(Product::factory()->create(['stock' => 5]));
        unset($this->gateway->intents[$this->intentId($broken)]);
        $this->gateway->authorize($this->intentId($healthy));

        $this->travel(6)->minutes();
        $this->artisan('payments:reconcile')->expectsOutputToContain('error 1')->assertSuccessful();

        $this->assertSame(OrderStatus::Paid, $healthy->fresh()->status);
    }

    public function test_a_webhook_event_delivered_twice_is_processed_once(): void
    {
        $product = Product::factory()->create(['stock' => 5]);
        $order = $this->placeOrder($product);
        $this->gateway->authorize($this->intentId($order));
        $event = $this->event('evt_1', 'payment_intent.amount_capturable_updated', $this->intentId($order));

        $this->webhook($event)->assertOk()->assertJsonPath('outcome', 'finalized');
        $this->webhook($event)->assertOk()->assertJsonPath('outcome', 'duplicate');

        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
        $this->assertSame(4, $product->fresh()->stock);
        $this->assertSame(1, $order->statusHistory()->where('to_status', 'paid')->count());
        $stored = StripeEvent::findOrFail('evt_1');
        $this->assertNotNull($stored->processed_at);
        $this->assertSame(1, $stored->attempts);
        $this->assertSame($this->intentId($order), $stored->payment_intent_id);
    }

    public function test_a_crash_while_processing_lets_stripe_retry_the_event(): void
    {
        $order = $this->placeOrder(Product::factory()->create(['stock' => 5]));
        $id = $this->intentId($order);
        $this->gateway->authorize($id);
        $flaky = new class extends FakePaymentGateway
        {
            public bool $down = true;

            public function retrieve(string $intentId): PaymentIntentData
            {
                return $this->down ? throw new RuntimeException('Stripe timed out') : parent::retrieve($intentId);
            }
        };
        $flaky->intents = $this->gateway->intents;
        $this->app->instance(PaymentGateway::class, $flaky);
        $event = $this->event('evt_2', 'payment_intent.amount_capturable_updated', $id);

        $this->webhook($event)->assertStatus(500);
        $this->assertNull(StripeEvent::findOrFail('evt_2')->processed_at);

        $flaky->down = false;
        $this->webhook($event)->assertOk()->assertJsonPath('outcome', 'finalized');

        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
        $this->assertSame(2, StripeEvent::findOrFail('evt_2')->attempts);
    }

    public function test_events_with_a_bad_signature_or_an_unknown_intent_change_nothing(): void
    {
        $event = $this->event('evt_3', 'payment_intent.succeeded', 'pi_not_ours');

        $this->call('POST', '/api/v1/webhooks/stripe', [], [], [], ['HTTP_STRIPE_SIGNATURE' => 't=1,v1=forged', 'CONTENT_TYPE' => 'application/json'], $event)
            ->assertStatus(400);
        $this->assertSame(0, StripeEvent::count());

        $this->webhook($event)->assertOk()->assertJsonPath('outcome', 'ignored');
        $this->assertSame('ignored', StripeEvent::findOrFail('evt_3')->outcome);
    }

    public function test_old_processed_events_are_pruned(): void
    {
        $this->webhook($this->event('evt_old', 'payment_intent.succeeded', 'pi_x'))->assertOk();
        $this->travel(31)->days();
        $this->webhook($this->event('evt_new', 'payment_intent.succeeded', 'pi_y'))->assertOk();

        $this->artisan('model:prune', ['--model' => [StripeEvent::class]])->assertSuccessful();

        $this->assertSame(['evt_new'], StripeEvent::pluck('id')->all());
    }

    private function placeOrder(Product $product, int $quantity = 1): Order
    {
        $this->actingAsCustomer();
        $this->postJson('/api/v1/cart/items', ['product_id' => $product->id, 'quantity' => $quantity, 'color' => 'Black', 'size' => 'Medium'])->assertOk();
        $number = $this->postJson('/api/v1/checkout', ['shipping' => [
            'name' => 'Jane Doe', 'phone' => '+1 555 123 4567', 'line1' => '1 Main St', 'city' => 'Springfield', 'postal_code' => '12345', 'country' => 'us',
        ]])->assertCreated()->json('data.order.order_number');

        return Order::where('order_number', $number)->firstOrFail();
    }

    private function intentId(Order $order): string
    {
        return $order->latestPayment()->firstOrFail()->provider_payment_id;
    }

    private function event(string $id, string $type, string $intentId): string
    {
        return json_encode([
            'id' => $id, 'object' => 'event', 'type' => $type, 'livemode' => false, 'api_version' => '2024-06-20',
            'data' => ['object' => ['id' => $intentId, 'object' => 'payment_intent']],
        ]);
    }

    private function webhook(string $payload)
    {
        $timestamp = time();
        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", self::SECRET);

        return $this->call('POST', '/api/v1/webhooks/stripe', [], [], [], [
            'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], $payload);
    }
}
