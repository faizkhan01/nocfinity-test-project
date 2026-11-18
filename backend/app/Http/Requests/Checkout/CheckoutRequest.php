<?php

namespace App\Http\Requests\Checkout;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'shipping' => ['required', 'array'],
            'shipping.name' => ['required', 'string', 'min:2', 'max:255'],
            'shipping.phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+\-\s()]{6,30}$/'],
            'shipping.line1' => ['required', 'string', 'max:255'],
            'shipping.line2' => ['nullable', 'string', 'max:255'],
            'shipping.city' => ['required', 'string', 'max:100'],
            'shipping.state' => ['nullable', 'string', 'max:100'],
            'shipping.postal_code' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9\-\s]{3,20}$/'],
            'shipping.country' => ['required', 'string', 'size:2', 'alpha'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return array<string, string|null> */
    public function shipping(): array
    {
        $shipping = $this->validated('shipping');
        $shipping['country'] = strtoupper($shipping['country']);

        return array_intersect_key($shipping, array_flip(['name', 'phone', 'line1', 'line2', 'city', 'state', 'postal_code', 'country']));
    }
}
