<?php

namespace App\Http\Resources;

use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Staff */
class StaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'is_active' => $this->is_active,
            'is_super_admin' => $this->isSuperAdmin(),
            'two_factor_enabled' => $this->two_factor_confirmed_at !== null,
            'roles' => $this->roles->map(fn ($role) => ['id' => $role->id, 'name' => $role->name, 'slug' => $role->slug]),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'permissions' => $this->when($request->routeIs('admin.auth.*', 'admin.profile.*'), fn () => $this->permissionNames()),
        ];
    }
}
