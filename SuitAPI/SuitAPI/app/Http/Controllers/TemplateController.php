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
            'templates.*.requirements' => 'nullable|array',
            'templates.*.requirements.*.id_requisito' => 'required|exists:requisitos,id',
            'templates.*.requirements.*.id_campo' => 'required|integer',
            'templates.*.requirements.*.NEntidad' => 'required|integer',
            'templates.*.requirements.*.note' => 'nullable|string',
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
                            if (isset($templateData['requirements']) && is_array($templateData['requirements'])) {
                                $this->syncRequirements($template, $templateData['requirements']);
                            }
                            $synced[] = $template->load('requirements');
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
                    if (isset($templateData['requirements']) && is_array($templateData['requirements'])) {
                        $this->syncRequirements($template, $templateData['requirements']);
                    }
                    $synced[] = $template->load('requirements');
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

        if ($request->has('requirements')) {
            $this->syncRequirements($template, $request->input('requirements'));
            $template->load('requirements');
        }

        return new TemplateResource($template);
    }

    /**
     * Display the specified resource.
     */
    public function show(Template $template): TemplateResource
    {
        $template->load(['category', 'requirements']);

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

        if ($request->has('requirements')) {
            $this->syncRequirements($template, $request->input('requirements'));
            $template->load('requirements');
        }

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

    /**
     * Sync requirements for a template.
     */
    private function syncRequirements(Template $template, array $requirements): void
    {
        $syncData = [];
        foreach ($requirements as $req) {
            // Using a composite primary key approach for the sync array:
            // requirement_id => [id_campo => ...]
            // But Laravel's sync normally expects unique keys for the relationship.
            // Since our pivot has a composite key [template_id, requisito_id, id_campo],
            // standard sync might not work if the user wants multiple id_campo for the same requisito_id.

            // If the user wants to allow multiple id_campo for the same requisito_id,
            // we should probably use detach/attach or a more manual approach.
        }

        // Given the constraints and the user request, we'll manually handle it to ensure all requirements are created correctly.
        $template->requirements()->detach();

        foreach ($requirements as $req) {
            $template->requirements()->attach($req['id_requisito'], [
                'id_campo' => $req['id_campo'],
                'NEntidad' => $req['NEntidad'],
                'note' => $req['note'] ?? null,
            ]);
        }

        $template->touch();
    }
}
