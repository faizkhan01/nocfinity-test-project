<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\StaffResource;
use App\Models\Staff;
use App\Services\Auth\LoginService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StaffAuthController extends Controller
{
    public function __construct(private readonly LoginService $login) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $staff = $this->login->attempt(
            Staff::query(), $request->string('email'), $request->string('password'), $request, 'staff',
        );

        return response()->json([
            'data' => [
                ...$this->login->issueToken($staff, 'admin', $request),
                'user' => new StaffResource($staff->load('roles')),
            ],
        ]);
    }

    public function me(Request $request): StaffResource
    {
        return new StaffResource($request->user()->load('roles'));
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
