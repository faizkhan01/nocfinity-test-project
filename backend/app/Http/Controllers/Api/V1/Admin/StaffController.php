<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StaffRequest;
use App\Http\Resources\StaffResource;
use App\Models\Staff;
use App\Services\Admin\StaffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class StaffController extends Controller
{
    public function __construct(private readonly StaffService $staff) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        $staff = Staff::with('roles')
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term));
            })
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString();

        return StaffResource::collection($staff);
    }

    public function show(Staff $staff): StaffResource
    {
        return new StaffResource($staff->load('roles'));
    }

    public function store(StaffRequest $request): JsonResponse
    {
        $staff = $this->staff->create($request->user(), $request->validated());

        return (new StaffResource($staff->load('roles')))->response()->setStatusCode(201);
    }

    public function update(StaffRequest $request, Staff $staff): StaffResource
    {
        return new StaffResource($this->staff->update($request->user(), $staff, $request->validated())->load('roles'));
    }

    public function destroy(Request $request, Staff $staff): Response
    {
        $this->staff->delete($request->user(), $staff);

        return response()->noContent();
    }
}
