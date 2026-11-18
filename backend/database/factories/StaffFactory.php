<?php

namespace Database\Factories;

use App\Models\Role;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Staff> */
class StaffFactory extends Factory
{
    protected $model = Staff::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => 'Password@123',
        ];
    }

    public function withRole(string $slug): static
    {
        return $this->afterCreating(fn (Staff $staff) => $staff->roles()->attach(Role::where('slug', $slug)->firstOrFail()));
    }
}
