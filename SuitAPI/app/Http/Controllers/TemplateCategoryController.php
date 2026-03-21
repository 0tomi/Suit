<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Http\Requests\StoreTemplateCategoryRequest;
use App\Http\Requests\UpdateTemplateCategoryRequest;
use App\Http\Resources\TemplateCategoryResource;
use App\Models\TemplateCategory;
use App\Models\Tombstone;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

class TemplateCategoryController extends Controller
{
    use ChecksForConflict;

    /**
     * Display a listing of the resource.
     */
    public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('viewAny', TemplateCategory::class);

        return TemplateCategoryResource::collection(TemplateCategory::all());
    }

    /**
     * Return categories modified after `since` plus IDs of categories deleted since then.
     * Used by the offline client to detect catalog structure changes incrementally.
     */
    public function syncDown(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('viewAny', TemplateCategory::class);

        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);

        $categories = TemplateCategory::where('updated_at', '>=', $since)->get();
        $deletedIds = Tombstone::deletedSince(Tombstone::TYPE_TEMPLATE_CATEGORY, $since);

        return TemplateCategoryResource::collection($categories)->additional([
            'deleted_ids' => $deletedIds,
        ]);
    }

    /**
     * Receive multiple template categories from client offline database to update/create them.
     */
    public function syncUp(Request $request): \Illuminate\Http\JsonResponse
    {
        Gate::authorize('create', TemplateCategory::class);

        $request->validate([
            'categories' => 'required|array',
            'categories.*.name' => 'required|string',
        ]);

        $synced = [];
        $conflicts = [];

        foreach ($request->categories as $categoryData) {
            try {
                if (isset($categoryData['id']) && $categoryData['id']) {
                    // Update
                    $category = TemplateCategory::find($categoryData['id']);
                    if ($category) {
                        try {
                            $this->checkForConflict($category, $categoryData);
                            $category->update($categoryData);
                            $synced[] = clone $category;
                        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                            if ($e->getStatusCode() === 409) {
                                $conflicts[] = $categoryData['id'];
                            } else {
                                throw $e;
                            }
                        }
                    }
                } else {
                    // Create
                    $category = TemplateCategory::create($categoryData);
                    $synced[] = $category;
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        return response()->json([
            'synced' => TemplateCategoryResource::collection($synced),
            'conflicts' => $conflicts,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTemplateCategoryRequest $request): TemplateCategoryResource
    {
        Gate::authorize('create', TemplateCategory::class);
        $category = TemplateCategory::create($request->validated());

        return new TemplateCategoryResource($category);
    }

    /**
     * Display the specified resource.
     */
    public function show(TemplateCategory $templateCategory): TemplateCategoryResource
    {
        Gate::authorize('view', $templateCategory);
        $templateCategory->load('templates');

        return new TemplateCategoryResource($templateCategory);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTemplateCategoryRequest $request, TemplateCategory $templateCategory): TemplateCategoryResource
    {
        Gate::authorize('update', $templateCategory);

        $this->checkForConflict($templateCategory, $request);

        $templateCategory->update($request->validated());

        return new TemplateCategoryResource($templateCategory);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(TemplateCategory $templateCategory): \Illuminate\Http\Response
    {
        Gate::authorize('delete', $templateCategory);
        $templateCategory->delete();

        return response()->noContent();
    }

    /**
     * Get a lightweight list of template titles for a given category.
     * Returns only id and title, without the heavy content field.
     */
    public function templatesList(TemplateCategory $templateCategory): \Illuminate\Http\JsonResponse
    {
        Gate::authorize('view', $templateCategory);

        return response()->json($templateCategory->getLightweightTemplates());
    }
}
