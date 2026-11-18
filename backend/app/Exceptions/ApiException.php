<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/** A business-rule failure the client can act on, rendered as { message, code, errors? }. */
class ApiException extends Exception
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $status = 422,
        public readonly array $errors = [],
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(array_filter([
            'message' => $this->getMessage(),
            'code' => $this->errorCode,
            'errors' => $this->errors ?: null,
        ]), $this->status);
    }
}
