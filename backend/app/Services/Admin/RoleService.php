<?php

namespace App\Services\Admin;

use App\Exceptions\ApiException;
use App\Models\Permission;
use App\Models\Role;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoleService
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /** @param array{name: string, description?: string|null, permissions: list<string>} $data */
    public function create(array $data): Role
    {
        return DB::transaction(function () use ($data) {
            $role = Role::create([
                'name' => $data['name'],
                'slug' => $this->uniqueSlug($data['name']),
                'description' => $data['description'] ?? null,
            ]);
            $role->permissions()->sync($this->permissionIds($data['permissions']));
            $this->activity->log('role.created', $role, ['permissions' => $data['permissions']]);

            return $role;
        });
    }

    /** @param array{name: string, description?: string|null, permissions: list<string>} $data */
    public function update(Role $role, array $data): Role
    {
        $this->guardSuperAdmin($role);

        return DB::transaction(function () use ($role, $data) {
            $role->update(['name' => $data['name'], 'description' => $data['description'] ?? null]);
            $changes = $role->permissions()->sync($this->permissionIds($data['permissions']));
            $this->activity->log('role.updated', $role, $changes);

            return $role;
        });
    }

    public function delete(Role $role): void
    {
        $this->guardSuperAdmin($role);

        if ($role->is_system) {
            throw new ApiException('Built-in roles cannot be deleted.', 'protected_role', 409);
        }

        if ($role->staff()->exists()) {
            throw new ApiException('Remove this role from all staff members before deleting it.', 'role_in_use', 409);
        }

        $this->activity->log('role.deleted', null, ['role' => $role->only('id', 'name', 'slug')]);
        $role->delete();
    }

    private function guardSuperAdmin(Role $role): void
    {
        if ($role->isSuperAdmin()) {
            throw new ApiException('The Super Admin role cannot be modified.', 'protected_role', 403);
        }
    }

    /** @param list<string> $names @return list<int> */
    private function permissionIds(array $names): array
    {
        return Permission::whereIn('name', $names)->pluck('id')->all();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        $slug = $base;

        for ($i = 2; Role::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
