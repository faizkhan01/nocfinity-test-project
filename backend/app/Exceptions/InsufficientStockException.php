<?php

namespace App\Exceptions;

class InsufficientStockException extends ApiException
{
    /** @param array<string, list<string>> $errors keyed by "items.{product_id}" */
    public function __construct(string $message, array $errors = [])
    {
        parent::__construct($message, 'insufficient_stock', 409, $errors);
    }
}
