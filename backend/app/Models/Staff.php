<?php

namespace App\Models;

use App\Enums\UserType;
use Database\Factories\StaffFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;

class Staff extends User
{
    /** @use HasFactory<StaffFactory> */
    use HasFactory;

    public const SUPER_ADMIN = 'super-admin';

    protected $attributes = ['type' => 'staff', 'is_active' => true];

    /** @var Collection<int, string>|null */
    private ?Collection $permissionCache = null;

    protected static function booted(): void
    {
        static::addGlobalScope('staff', fn (Builder $q) => $q->where('users.type', UserType::Staff->value));
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user', 'user_id', 'role_id');
    }

    public function isSuperAdmin(): bool
    {
        return $this->roles->contains('slug', self::SUPER_ADMIN);
    }

    /** @return Collection<int, string> */
    public function permissionNames(): Collection
    {
        if ($this->permissionCache !== null) {
            return $this->permissionCache;
        }

        if ($this->isSuperAdmin()) {
            return $this->permissionCache = Permission::query()->orderBy('name')->pluck('name');
        }

        $this->loadMissing('roles.permissions');

        return $this->permissionCache = $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
            ->unique()->sort()->values();
    }

    public function hasPermission(string $permission): bool
    {
        return $this->isSuperAdmin() || $this->permissionNames()->contains($permission);
    }

    public function flushPermissionCache(): void
    {
        $this->permissionCache = null;
        $this->unsetRelation('roles');
    }
}
