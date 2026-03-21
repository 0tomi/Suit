<?php

namespace App\Http\Controllers;

use App\Models\PublicFileCatalog;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;

class PublicFileCatalogController extends Controller
{
    use AuthorizesRequests;

    public function index()
    {
        $this->authorize('viewAny', PublicFileCatalog::class);

        return response()->json(PublicFileCatalog::all());
    }

    public function store(Request $request)
    {
        $this->authorize('create', PublicFileCatalog::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:public_file_catalogs,name'],
            'description' => ['nullable', 'string'],
        ]);

        $catalog = PublicFileCatalog::create($data);

        return response()->json($catalog, 201);
    }

    public function show($id)
    {
        $catalog = PublicFileCatalog::findOrFail($id);
        $this->authorize('view', $catalog);

        return response()->json($catalog);
    }

    public function update(Request $request, $id)
    {
        $catalog = PublicFileCatalog::findOrFail($id);
        $this->authorize('update', $catalog);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', 'unique:public_file_catalogs,name,'.$catalog->id],
            'description' => ['nullable', 'string'],
        ]);

        $catalog->update($data);

        return response()->json($catalog);
    }

    public function destroy($id)
    {
        $catalog = PublicFileCatalog::findOrFail($id);
        $this->authorize('delete', $catalog);
        $catalog->delete();

        return response()->noContent();
    }
}
