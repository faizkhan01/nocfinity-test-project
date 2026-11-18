<?php

namespace App\Http\Resources;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Role */
class RoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_system' => $this->is_system,
            'is_super_admin' => $this->isSuperAdmin(),
            'permissions' => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('name')),
            'staff_count' => $this->whenCounted('staff'),
        ];
    }
}
