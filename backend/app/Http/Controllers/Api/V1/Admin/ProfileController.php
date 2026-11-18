<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Resources\StaffResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function update(Request $request): StaffResource
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:100']]);

        $request->user()->update($data);

        return new StaffResource($request->user()->load('roles'));
    }

    /** Changing the password signs out every other session. */
    public function password(UpdatePasswordRequest $request): JsonResponse
    {
        $staff = $request->user();
        $staff->update(['password' => $request->string('password')]);
        $staff->tokens()->where('id', '!=', $staff->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Password updated.']);
    }
}
