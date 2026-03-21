<?php

namespace App\Http\Controllers;

use App\Models\CaseType;
use Illuminate\Http\Request;

class CaseTypeController extends Controller
{
    public function index()
    {
        $this->authorize('viewAny', CaseType::class);

        return response()->json(CaseType::all());
    }

    public function store(Request $request)
    {
        $this->authorize('create', CaseType::class);

        $validated = $request->validate([
            'name' => 'required|string|unique:case_types,name',
            'description' => 'nullable|string',
            'eventColor' => 'nullable|string|max:15',
        ]);

        $type = CaseType::create($validated);

        return response()->json($type, 201);
    }

    public function update(Request $request, CaseType $caseType)
    {
        $this->authorize('update', $caseType);

        $validated = $request->validate([
            'name' => 'required|string|unique:case_types,name,'.$caseType->id,
            'description' => 'nullable|string',
            'eventColor' => 'nullable|string|max:15',
        ]);

        $caseType->update($validated);

        return response()->json($caseType);
    }

    public function destroy(CaseType $caseType)
    {
        $this->authorize('delete', $caseType);

        $caseType->delete();

        return response()->json(null, 204);
    }
}
