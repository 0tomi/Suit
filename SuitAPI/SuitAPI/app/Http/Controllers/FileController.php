<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFileRequest;
use App\Models\File;
use App\Models\SuitCase;
use App\Services\BitacoraService;
use App\Services\FileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FileController extends Controller
{
    public function __construct(
        protected FileService $fileService,
        protected BitacoraService $bitacora
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $query = File::query();

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

        $files = $query->paginate(15);

        return response()->json($files);
    }

    public function store(StoreFileRequest $request)
    {
        $user = $request->user();

        // Authorization check
        if ($request->has('suit_case_id') && $request->suit_case_id) {
            $suitCase = SuitCase::findOrFail($request->suit_case_id);
            Gate::authorize('case-write', $suitCase);
        }

        $fileRecord = $this->fileService->storeFile($request->file('file'), $request->all(), $user);

        $this->bitacora->record('uploaded', $fileRecord);

        return response()->json($fileRecord, 201);
    }

    public function show(Request $request, File $file)
    {
        // Authorization check
        $user = $request->user();
        $isOwner = $file->user_id === $user->id;
        $suitCase = $file->suitCase;
        $isParticipant = $suitCase && ($suitCase->lawyer_id === $user->id || $suitCase->participants()->where('users.id', $user->id)->exists());

        if (! $isOwner && ! $isParticipant && $user->role !== 'admin') {
            return response()->json(['message' => 'No tienes permiso para ver este archivo.'], 403);
        }

        $content = $this->fileService->getFileContent($file);

        return response($content, 200, [
            'Content-Type' => $file->mime_type,
            'Content-Disposition' => 'attachment; filename="'.$file->filename.'"',
        ]);
    }

    public function destroy(Request $request, File $file)
    {
        // Authorization check
        Gate::authorize('case-write', $file);

        $this->fileService->delete($file);

        $this->bitacora->record('deleted', $file);

        return response()->json(null, 204);
    }
}
