<?php

namespace App\Models;

use App\Enums\UserType;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Customer extends User
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    protected $attributes = ['type' => 'customer', 'is_active' => true];

    protected static function booted(): void
    {
        static::addGlobalScope('customer', fn (Builder $q) => $q->where('users.type', UserType::Customer->value));
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'user_id');
    }

    public function cart(): HasOne
    {
        return $this->hasOne(Cart::class, 'user_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class, 'user_id');
    }
}
