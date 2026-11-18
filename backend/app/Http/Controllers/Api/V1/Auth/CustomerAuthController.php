<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Services\Auth\LoginService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CustomerAuthController extends Controller
{
    public function __construct(private readonly LoginService $login) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $customer = Customer::create($request->validated());

        event(new Registered($customer));

        return $this->authenticated($customer, $request, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $customer = $this->login->attempt(
            Customer::query(), $request->string('email'), $request->string('password'), $request, 'customer',
        );

        return $this->authenticated($customer, $request);
    }

    public function me(Request $request): CustomerResource
    {
        return new CustomerResource($request->user());
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function authenticated(Customer $customer, Request $request, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => [
                ...$this->login->issueToken($customer, 'customer', $request),
                'user' => new CustomerResource($customer),
            ],
        ], $status);
    }
}
