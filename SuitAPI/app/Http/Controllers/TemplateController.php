<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Http\Requests\StoreTemplateRequest;
use App\Http\Requests\UpdateTemplateRequest;
use App\Http\Resources\TemplateResource;
use App\Models\Template;
use App\Models\TemplateCategory;
use App\Models\Tombstone;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TemplateController extends Controller
{
    use ChecksForConflict;

    /**
     * Display a listing of the resource.
     */
    public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        return TemplateResource::collection(Template::getLightweightCatalog());
    }

    /**
     * Return templates modified after `since` plus IDs of templates deleted since then.
     * Used by the offline client to download catalog changes incrementally.
     */
    public function syncDown(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);

        $templates = Template::where('updated_at', '>=', $since)->get();
        $deletedIds = Tombstone::deletedSince(Tombstone::TYPE_TEMPLATE, $since);

        return TemplateResource::collection($templates)->additional([
            'deleted_ids' => $deletedIds,
        ]);
    }

    /**
     * Receive multiple templates from client offline database to update/create them.
     */
    public function syncUp(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'templates' => 'required|array',
            'templates.*.title' => 'required|string',
            'templates.*.content' => 'required|string',
        ]);

        $synced = [];
        $conflicts = [];

        foreach ($request->templates as $templateData) {
            try {
                if (is_null($templateData['template_category_id'] ?? null)) {
                    $templateData['template_category_id'] = TemplateCategory::defaultCategory()->id;
                }

                if (isset($templateData['id']) && $templateData['id']) {
                    // Update
                    $template = Template::find($templateData['id']);
                    if ($template) {
                        try {
                            $this->checkForConflict($template, $templateData);
                            $template->update($templateData);
                            $synced[] = clone $template;
                        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                            if ($e->getStatusCode() === 409) {
                                $conflicts[] = $templateData['id'];
                            } else {
                                throw $e;
                            }
                        }
                    }
                } else {
                    // Create
                    $template = Template::create($templateData);
                    $synced[] = $template;
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        return response()->json([
            'synced' => TemplateResource::collection($synced),
            'conflicts' => $conflicts,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTemplateRequest $request): TemplateResource
    {
        $validated = $request->validated();
        if (is_null($validated['template_category_id'] ?? null)) {
            $validated['template_category_id'] = TemplateCategory::defaultCategory()->id;
        }

        $template = Template::create($validated);

        return new TemplateResource($template);
    }

    /**
     * Display the specified resource.
     */
    public function show(Template $template): TemplateResource
    {
        $template->load('category');

        return new TemplateResource($template);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateTemplateRequest $request, Template $template): TemplateResource
    {
        $this->checkForConflict($template, $request);

        $validated = $request->validated();
        if (
            array_key_exists('template_category_id', $validated) &&
            is_null($validated['template_category_id'])
        ) {
            $validated['template_category_id'] = TemplateCategory::defaultCategory()->id;
        }

        $template->update($validated);

        return new TemplateResource($template);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Template $template): \Illuminate\Http\Response
    {
        \Illuminate\Support\Facades\Gate::authorize('delete', $template);
        $template->delete();

        return response()->noContent();
    }
}
