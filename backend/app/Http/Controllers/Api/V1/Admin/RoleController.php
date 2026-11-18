<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Permission;
use App\Models\Role;
use App\Services\Admin\RoleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class RoleController extends Controller
{
    public function __construct(private readonly RoleService $roles) {}

    public function index(): AnonymousResourceCollection
    {
        return RoleResource::collection(Role::with('permissions')->withCount('staff')->orderBy('id')->get());
    }

    /** Permissions grouped for the matrix UI. */
    public function permissions(): JsonResponse
    {
        $groups = Permission::orderBy('id')->get(['name', 'group', 'description'])->groupBy('group')
            ->map(fn ($items, $group) => ['group' => $group, 'permissions' => $items->map->only('name', 'description')->values()])
            ->values();

        return response()->json(['data' => $groups]);
    }

    public function store(RoleRequest $request): JsonResponse
    {
        $role = $this->roles->create($request->validated());

        return (new RoleResource($role->load('permissions')->loadCount('staff')))->response()->setStatusCode(201);
    }

    public function update(RoleRequest $request, Role $role): RoleResource
    {
        $role = $this->roles->update($role, $request->validated());

        return new RoleResource($role->load('permissions')->loadCount('staff'));
    }

    public function destroy(Role $role): Response
    {
        $this->roles->delete($role);

        return response()->noContent();
    }
}
