<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Every Stripe webhook event, so a redelivery is never processed twice and each outcome can be audited.
    public function up(): void
    {
        Schema::create('stripe_events', function (Blueprint $table) {
            $table->string('id', 255)->primary();
            $table->string('type', 100);
            $table->string('payment_intent_id', 255)->nullable()->index();
            $table->boolean('livemode')->default(false);
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('processed_at')->nullable()->index();
            $table->string('outcome', 100)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_events');
    }
};
