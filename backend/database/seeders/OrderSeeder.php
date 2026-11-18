<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Services\Catalog\ReviewService;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/** Demo customers, orders in every status over the last 30 days, and verified-buyer reviews. */
class OrderSeeder extends Seeder
{
    private const LIFECYCLE = ['pending', 'paid', 'processing', 'shipped', 'delivered'];

    private const REVIEWS = [
        'One Life Graphic T-shirt' => [
            ['Samantha D.', 5, "I absolutely love this t-shirt! The design is unique and the fabric feels so comfortable. As a fellow designer, I appreciate the attention to detail. It's become my favorite go-to shirt."],
            ['Alex M.', 4, "The t-shirt exceeded my expectations! The colors are vibrant and the print quality is top-notch. Being a UI/UX designer myself, I'm quite picky about aesthetics, and this t-shirt definitely gets a thumbs up from me."],
            ['Ethan R.', 4, "This t-shirt is a must-have for anyone who appreciates good design. The minimalistic yet stylish pattern caught my eye, and the fit is perfect. I can see the designer's touch in every aspect of this shirt."],
            ['Olivia P.', 4, "As a UI/UX enthusiast, I value simplicity and functionality. This t-shirt not only represents those principles but also feels great to wear. It's evident that the designer poured their creativity into making this t-shirt stand out."],
            ['Liam K.', 4, "This t-shirt is a fusion of comfort and creativity. The fabric is soft, and the design speaks volumes about the designer's skill. It's like wearing a piece of art that reflects my passion for both design and fashion."],
            ['Ava H.', 5, "I'm not just wearing a t-shirt; I'm wearing a piece of design philosophy. The intricate details and thoughtful layout of the design make this shirt a conversation starter."],
            ['Sarah M.', 5, "I'm blown away by the quality and style of the clothes I received from Shop.co. From casual wear to elegant dresses, every piece I've bought has exceeded my expectations."],
            ['James L.', 5, "As someone who's always on the lookout for unique fashion pieces, I'm thrilled to have stumbled upon Shop.co. The selection of clothes is not only diverse but also on-point with the latest trends."],
        ],
        'Courage Graphic T-shirt' => [
            ['Alex K.', 4, 'Finding clothes that align with my personal style used to be a challenge until I discovered Shop.co. The range of options they offer is truly remarkable, catering to a variety of tastes and occasions.'],
            ['Mooen R.', 4, "As someone who's always on the lookout for unique fashion pieces, I'm thrilled with this one. Great colours and the print still looks new after many washes."],
        ],
    ];

    /** Two reviews per product averaging to the rating shown in the design. */
    private const RATING_PAIRS = [
        'T-shirt with Tape Details' => [5, 4], 'Skinny Fit Jeans' => [4, 3], 'Checkered Shirt' => [5, 4],
        'Sleeve Striped T-shirt' => [5, 4], 'Vertical Striped Shirt' => [5, 5], 'Loose Fit Bermuda Shorts' => [3, 3],
        'Faded Skinny Jeans' => [5, 4], 'Polo with Contrast Trims' => [4, 4], 'Gradient Graphic T-shirt' => [4, 3],
        'Polo with Tipping Details' => [5, 4], 'Black Striped T-shirt' => [5, 5], 'Classic Blue Denim' => [5, 4],
        'Washed Black Straight Jeans' => [4, 4], 'Plaid Flannel Overshirt' => [5, 4], 'Raglan Stripe Gym Tee' => [4, 4],
        'Denim Training Shorts' => [4, 3], 'Street Art Graphic Tee' => [5, 4],
    ];

    private const GENERIC_COMMENTS = [
        'Great fit and the fabric feels premium. Already ordered another colour.',
        'Exactly as pictured. Shipping was quick and the sizing guide was spot on.',
        'Comfortable for all-day wear and holds its shape after washing.',
        'Good value for the price, though I would size down if you prefer a slimmer fit.',
    ];

    public function run(ReviewService $reviews): void
    {
        $products = Product::with('primaryImage')->get()->keyBy('name');

        $demo = Customer::create([
            'name' => 'Jane Customer', 'email' => 'customer@nocfinity-shop.test', 'phone' => '+1 555 010 2030',
            'password' => 'Customer@123', 'email_verified_at' => now(),
        ]);
        $this->order($demo, [[$products['One Life Graphic T-shirt'], 1], [$products['Skinny Fit Jeans'], 1]], 'delivered', now()->subDays(12));
        $this->order($demo, [[$products['Checkered Shirt'], 2]], 'shipped', now()->subDays(3));
        $this->order($demo, [[$products['Polo with Tipping Details'], 1]], 'cancelled', now()->subDays(6));

        $shoppers = Customer::factory()->count(12)->create();
        $catalog = $products->filter(fn (Product $p) => $p->stock > 0)->values();

        // Settled orders spread over 30 days feed the dashboard chart; a few are in flight or cancelled.
        for ($i = 0; $i < 46; $i++) {
            $status = match (true) {
                $i < 3 => 'pending',
                $i < 6 => 'paid',
                $i < 10 => 'processing',
                $i < 15 => 'shipped',
                $i < 19 => 'cancelled',
                default => 'delivered',
            };
            $items = $catalog->random(rand(1, 3))->map(fn (Product $p) => [$p, rand(1, 2)])->all();
            $this->order($shoppers->random(), $items, $status, now()->subDays(rand(0, 29))->subHours(rand(0, 20)));
        }

        foreach (self::REVIEWS as $productName => $entries) {
            foreach ($entries as $index => [$name, $rating, $comment]) {
                $this->review($products[$productName], $this->reviewer($name), $rating, $comment, now()->subDays(60 - $index));
            }
        }

        foreach (self::RATING_PAIRS as $productName => $ratings) {
            foreach ($ratings as $index => $rating) {
                $this->review($products[$productName], $shoppers[($index + crc32($productName)) % $shoppers->count()], $rating,
                    self::GENERIC_COMMENTS[($index + strlen($productName)) % count(self::GENERIC_COMMENTS)], now()->subDays(rand(5, 40)));
            }
        }

        $products->each(fn (Product $p) => $reviews->refreshRating($p));
    }

    /** @param list<array{0: Product, 1: int}> $items */
    private function order(Customer $customer, array $items, string $status, CarbonInterface $placedAt): Order
    {
        $lines = collect($items)->unique(fn ($line) => $line[0]->id)->values();
        $subtotal = $lines->sum(fn ($line) => $line[0]->unitPriceCents() * $line[1]);
        $shipping = (int) config('shop.shipping_flat_cents');

        $order = new Order([
            'user_id' => $customer->id,
            'subtotal_cents' => $subtotal,
            'discount_cents' => 0,
            'shipping_cents' => $shipping,
            'total_cents' => $subtotal + $shipping,
            'currency' => strtoupper((string) config('shop.currency')),
            'shipping_name' => $customer->name,
            'shipping_phone' => $customer->phone ?? '+1 555 000 0000',
            'shipping_line1' => fake()->streetAddress(),
            'shipping_city' => fake()->city(),
            'shipping_state' => fake()->stateAbbr(),
            'shipping_postal_code' => fake()->postcode(),
            'shipping_country' => 'US',
        ]);
        $order->status = OrderStatus::from($status);
        $order->created_at = $order->updated_at = $placedAt;
        $this->stampDates($order, $status, $placedAt);
        $order->save();
        $order->order_number = Order::numberFor($order);
        $order->save();

        $order->items()->createMany($lines->map(fn ($line) => [
            'product_id' => $line[0]->id,
            'product_name' => $line[0]->name,
            'product_sku' => $line[0]->sku,
            'image_path' => $line[0]->primaryImage?->path,
            'color' => $line[0]->colors[0]['name'] ?? null,
            'size' => $line[0]->sizes[1] ?? $line[0]->sizes[0] ?? null,
            'unit_price_cents' => $line[0]->unitPriceCents(),
            'quantity' => $line[1],
            'line_total_cents' => $line[0]->unitPriceCents() * $line[1],
        ])->all());

        $this->history($order, $status, $placedAt);
        $order->payments()->create([
            'provider' => 'stripe',
            'provider_payment_id' => 'pi_seed_'.Str::random(16),
            'status' => match ($status) {
                'pending' => PaymentStatus::Pending,
                'cancelled' => PaymentStatus::Refunded,
                default => PaymentStatus::Succeeded,
            },
            'amount_cents' => $order->total_cents,
            'currency' => $order->currency,
            'captured_at' => $order->paid_at,
            'refunded_at' => $status === 'cancelled' ? $order->cancelled_at : null,
        ]);

        return $order;
    }

    private function stampDates(Order $order, string $status, CarbonInterface $placedAt): void
    {
        $reached = $status === 'cancelled' ? 1 : array_search($status, self::LIFECYCLE, true);
        $order->paid_at = $reached >= 1 ? $placedAt->copy()->addMinutes(2) : null;
        $order->shipped_at = $reached >= 3 ? $placedAt->copy()->addDay() : null;
        $order->delivered_at = $reached >= 4 ? $placedAt->copy()->addDays(3) : null;

        if ($status === 'cancelled') {
            $order->cancelled_at = $placedAt->copy()->addHours(5);
            $order->cancellation_reason = 'Cancelled by customer';
        }
    }

    private function history(Order $order, string $status, CarbonInterface $placedAt): void
    {
        $path = $status === 'cancelled' ? ['pending', 'paid', 'cancelled'] : array_slice(self::LIFECYCLE, 0, array_search($status, self::LIFECYCLE, true) + 1);
        $previous = null;

        foreach ($path as $step => $to) {
            $order->statusHistory()->create(['from_status' => $previous, 'to_status' => $to])
                ->forceFill(['created_at' => $placedAt->copy()->addHours($step * 6)])->save();
            $previous = $to;
        }
    }

    private function reviewer(string $name): Customer
    {
        return Customer::firstOrCreate(
            ['email' => Str::slug($name, '.').'@example.com'],
            ['name' => $name, 'password' => 'Customer@123', 'email_verified_at' => now()],
        );
    }

    private function review(Product $product, Customer $customer, int $rating, string $comment, CarbonInterface $at): void
    {
        if (ProductReview::where('product_id', $product->id)->where('user_id', $customer->id)->exists()) {
            return;
        }

        $this->order($customer, [[$product, 1]], 'delivered', $at->copy()->subDays(5));
        $review = $product->reviews()->create(['user_id' => $customer->id, 'rating' => $rating, 'comment' => $comment]);
        $review->forceFill(['created_at' => $at, 'updated_at' => $at])->save();
    }
}
