<?php

namespace App\Services\Admin;

use App\Exceptions\ApiException;
use App\Models\Role;
use App\Models\Staff;
use App\Services\ActivityLogger;
use App\Services\Auth\TwoFactorService;
use Illuminate\Support\Facades\DB;

class StaffService
{
    public function __construct(
        private readonly ActivityLogger $activity,
        private readonly TwoFactorService $twoFactor,
    ) {}

    /** @param array{name: string, email: string, password: string, is_active?: bool, roles: list<int>} $data */
    public function create(Staff $actor, array $data): Staff
    {
        $this->guardRoleAssignment($actor, $data['roles']);

        return DB::transaction(function () use ($data) {
            $staff = Staff::create([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                'password' => $data['password'],
                'is_active' => $data['is_active'] ?? true,
            ]);
            $staff->roles()->sync($data['roles']);
            $this->activity->log('staff.created', $staff, ['roles' => $data['roles']]);

            return $staff;
        });
    }

    /** @param array{name: string, email: string, password?: string|null, is_active?: bool, roles: list<int>} $data */
    public function update(Staff $actor, Staff $staff, array $data): Staff
    {
        $this->guardTarget($actor, $staff);
        $this->guardRoleAssignment($actor, $data['roles']);

        return DB::transaction(function () use ($staff, $data) {
            $staff->fill([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                'is_active' => $data['is_active'] ?? $staff->is_active,
            ]);

            if (! empty($data['password'])) {
                $staff->password = $data['password'];
            }

            $resetTwoFactor = ($data['reset_two_factor'] ?? false) && $staff->two_factor_confirmed_at;
            $sessionsInvalid = $staff->isDirty('password') || ($staff->isDirty('is_active') && ! $staff->is_active) || $resetTwoFactor;
            $staff->save();

            if ($resetTwoFactor) {
                $this->twoFactor->disable($staff);
                $this->activity->log('two_factor.reset', $staff);
            }
            $staff->roles()->sync($data['roles']);

            // A deactivated account or a reset password must not keep working through old tokens.
            if ($sessionsInvalid) {
                $staff->tokens()->delete();
            }

            $this->activity->log('staff.updated', $staff, ['roles' => $data['roles'], 'is_active' => $staff->is_active]);

            return $staff;
        });
    }

    public function delete(Staff $actor, Staff $staff): void
    {
        $this->guardTarget($actor, $staff);

        DB::transaction(function () use ($staff) {
            $staff->tokens()->delete();
            $this->activity->log('staff.deleted', null, ['staff' => $staff->only('id', 'name', 'email')]);
            $staff->delete();
        });
    }

    private function guardTarget(Staff $actor, Staff $staff): void
    {
        if ($actor->is($staff)) {
            throw new ApiException('Use your profile page to change your own account.', 'self_modification', 403);
        }

        if ($staff->isSuperAdmin()) {
            throw new ApiException('Super Admin accounts cannot be edited or deleted by others.', 'protected_account', 403);
        }
    }

    /** @param list<int> $roleIds */
    private function guardRoleAssignment(Staff $actor, array $roleIds): void
    {
        $grantsSuperAdmin = Role::whereIn('id', $roleIds)->where('slug', Staff::SUPER_ADMIN)->exists();

        if ($grantsSuperAdmin && ! $actor->isSuperAdmin()) {
            throw new ApiException('Only a Super Admin can grant the Super Admin role.', 'forbidden_role', 403);
        }
    }
}
