<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMultimediaRequest;
use App\Models\Multimedia;
use App\Models\SuitCase;
use App\Services\FileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MultimediaController extends Controller
{
    public function __construct(protected FileService $fileService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Multimedia::query();

        if ($user->role !== 'admin') {
            $query->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhereHas('suitCase', function ($query) use ($user) {
                        $query->where('lawyer_id', $user->id)
                            ->orWhereHas('participants', function ($q) use ($user) {
                                $q->where('users.id', $user->id);
                            });
                    });
            });
        }

        $multimedia = $query->paginate(15);

        return response()->json($multimedia);
    }

    public function store(StoreMultimediaRequest $request)
    {
        $user = $request->user();

        // Authorization check
        if ($request->has('suit_case_id') && $request->suit_case_id) {
            $suitCase = SuitCase::findOrFail($request->suit_case_id);
            Gate::authorize('case-write', $suitCase);
        }

        $multimedia = $this->fileService->storeMultimedia($request->file('file'), $request->all(), $user);

        return response()->json($multimedia, 201);
    }

    public function show(Request $request, Multimedia $multimedia)
    {
        // Authorization check
        $user = $request->user();
        $isOwner = $multimedia->user_id === $user->id;
        $suitCase = $multimedia->suitCase;
        $isParticipant = $suitCase && ($suitCase->lawyer_id === $user->id || $suitCase->participants()->where('users.id', $user->id)->exists());

        if (! $isOwner && ! $isParticipant && $user->role !== 'admin') {
            return response()->json(['message' => 'No tienes permiso para ver este archivo.'], 403);
        }

        $content = $this->fileService->getFileContent($multimedia);

        return response($content, 200, [
            'Content-Type' => $multimedia->mime_type,
            'Content-Disposition' => 'attachment; filename="'.$multimedia->filename.'"',
        ]);
    }

    public function destroy(Request $request, Multimedia $multimedia)
    {
        // Authorization check
        Gate::authorize('case-write', $multimedia);

        $this->fileService->delete($multimedia);

        return response()->json(null, 204);
    }
}
