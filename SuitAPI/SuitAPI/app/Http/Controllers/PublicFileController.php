<?php

namespace App\Http\Controllers;

use App\Http\Requests\PublicFile\StorePublicFileRequest;
use App\Http\Resources\PublicFileResource;
use App\Models\PublicFile;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PublicFileController extends Controller
{
    use \App\Traits\HandlesManualSignatures, AuthorizesRequests;

    /**
     * Display a listing of the resource by catalog.
     */
    public function indexByCatalog($catalog_id): JsonResource
    {
        $this->authorize('viewAny', PublicFile::class);
        $files = PublicFile::where('public_file_catalog_id', $catalog_id)
            ->latest()
            ->paginate(15);

        return PublicFileResource::collection($files);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePublicFileRequest $request): JsonResource
    {
        $this->authorize('create', PublicFile::class);

        $file = $request->file('file');
        $uuid = Str::uuid();
        $filename = $uuid.'.'.$file->extension();
        $path = $file->storeAs('/', $filename, 'public_files');

        $publicFile = PublicFile::create([
            'uuid' => $uuid,
            'user_id' => Auth::id(),
            'public_file_catalog_id' => $request->integer('public_file_catalog_id') ?: null,
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'hash' => hash_file('sha256', Storage::disk('public_files')->path($path)),
        ]);

        return new PublicFileResource($publicFile);
    }

    /**
     * Fetch incrementally changed records (including soft-deleted) since a given timestamp.
     */
    public function syncDown(Request $request): JsonResource
    {
        $this->authorize('viewAny', PublicFile::class);

        $request->validate([
            'last_sync' => ['required', 'date'],
        ]);

        $lastSync = \Carbon\Carbon::parse($request->input('last_sync'));

        // Retrieve both active and soft-deleted files that were updated since the given date
        $files = PublicFile::withTrashed()
            ->where('updated_at', '>=', $lastSync)
            ->get();

        return PublicFileResource::collection($files);
    }

    /**
     * Downloads the specified file.
     */
    public function download($id)
    {
        $publicFile = PublicFile::findOrFail($id);
        $this->authorize('download', $publicFile);

        if (! Storage::disk('public_files')->exists($publicFile->path)) {
            abort(404, 'File not found on disk.');
        }

        return response()->download(Storage::disk('public_files')->path($publicFile->path), $publicFile->name);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResource
    {
        $publicFile = PublicFile::findOrFail($id);
        $this->authorize('view', $publicFile);

        return new PublicFileResource($publicFile);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id): JsonResource
    {
        $publicFile = PublicFile::findOrFail($id);
        $this->authorize('update', $publicFile);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'public_file_catalog_id' => ['sometimes', 'nullable', 'exists:public_file_catalogs,id'],
        ]);

        // Fix logic where missing keys aren't updated. $data will only contain provided keys.
        $publicFile->update($data);

        return new PublicFileResource($publicFile);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): \Illuminate\Http\Response
    {
        $publicFile = PublicFile::findOrFail($id);
        $this->authorize('delete', $publicFile);
        $publicFile->delete();

        // The actual file remains on disk to allow for undeletion if needed.
        // A scheduled task could clean up old soft-deleted files.
        return response()->noContent();
    }

    /**
     * Get the last modification timestamp.
     */
    public function lastModified(): \Illuminate\Http\JsonResponse
    {
        // No authorization needed for this endpoint as it reveals no sensitive data
        $lastModified = PublicFile::latest('updated_at')->value('updated_at');

        return response()->json([
            'last_modified' => $lastModified?->toIso8601String(),
        ]);
    }

    /**
     * Generates a temporary signed URL for downloading a file.
     */
    public function generateSignedUrl($id): \Illuminate\Http\JsonResponse
    {
        $publicFile = PublicFile::findOrFail($id);
        $this->authorize('download', $publicFile);

        $url = $this->createManualSignedUrl(
            'public-files.download-signed',
            5,
            ['id' => $id]
        );

        return response()->json([
            'signed_url' => $url,
            'expires_at' => now()->addMinutes(5)->toIso8601String(),
        ]);
    }

    /**
     * Downloads the specified file using a signed URL.
     */
    public function downloadSigned(Request $request, $id)
    {
        $this->validateManualSignature($request, 'public-files.download-signed');

        $publicFile = PublicFile::findOrFail($id);

        if ($request->query('confirmed') !== '1') {
            return view('download', [
                'context' => 'public',
                'title' => 'Biblioteca Pública',
                'description' => 'Descarga segura de archivo de la biblioteca.',
                'filename' => $publicFile->name,
                'filesize' => number_format($publicFile->size / 1024 / 1024, 2).' MB',
            ]);
        }

        if (! Storage::disk('public_files')->exists($publicFile->path)) {
            abort(404, 'File not found on disk.');
        }

        return response()->download(Storage::disk('public_files')->path($publicFile->path), $publicFile->name);
    }

    /**
     * Generates a temporary signed URL for uploading a file to PublicFiles.
     */
    public function generateUploadLink(Request $request): \Illuminate\Http\JsonResponse
    {
        $this->authorize('create', PublicFile::class);

        $request->validate([
            'public_file_catalog_id' => ['sometimes', 'nullable', 'exists:public_file_catalogs,id'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*.user_id' => ['required', 'exists:users,id'],
            'permissions.*.can_update' => ['required', 'boolean'],
            'permissions.*.can_delete' => ['required', 'boolean'],
        ]);

        $expiresAt = now()->addMinutes(15);
        $url = $this->createManualSignedUrl(
            'public-files.upload-signed',
            15,
            [
                'public_file_catalog_id' => $request->integer('public_file_catalog_id') ?: null,
                'permissions_json' => $request->has('permissions') ? json_encode($request->input('permissions')) : null,
                'generator_id' => Auth::id(),
            ]
        );

        return response()->json([
            'upload_url' => $url,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);
    }

    /**
     * Handles the upload of files using a signed URL.
     */
    public function uploadSigned(Request $request): \Illuminate\Http\Response|JsonResource|\Illuminate\Contracts\View\View
    {
        $this->validateManualSignature($request, 'public-files.upload-signed');

        if ($request->isMethod('GET')) {
            return view('upload', [
                'context' => 'public',
                'title' => 'Biblioteca Pública',
                'description' => 'Sube archivos a la biblioteca compartida de Suit.',
                'accept' => '.txt,.pdf,.md,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.odp,.zip,.rar,.7z',
                'allowed_formats' => 'Documentos, Hojas de cálculo y comprimidos',
            ]);
        }

        $request->validate([
            'files' => ['required', 'array'],
            'files.*' => [
                'file',
                'mimes:txt,pdf,md,xls,xlsx,doc,docx,ppt,pptx,odp,zip,rar,7z',
            ],
        ]);

        $createdFiles = [];
        $files = $request->file('files');

        foreach ($files as $file) {
            $uuid = Str::uuid();
            $filename = $uuid.'.'.$file->extension();
            $path = $file->storeAs('/', $filename, 'public_files');

            $publicFile = PublicFile::create([
                'uuid' => $uuid,
                'user_id' => $request->input('generator_id'),
                'public_file_catalog_id' => $request->input('public_file_catalog_id') ?: null,
                'name' => $file->getClientOriginalName(),
                'path' => $path,
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'hash' => hash_file('sha256', Storage::disk('public_files')->path($path)),
            ]);

            // Apply permissions if provided
            if ($request->has('permissions_json') && $request->input('permissions_json')) {
                $permissions = json_decode($request->input('permissions_json'), true);
                foreach ($permissions as $perm) {
                    $publicFile->permissions()->create([
                        'user_id' => $perm['user_id'],
                        'can_update' => $perm['can_update'],
                        'can_delete' => $perm['can_delete'],
                    ]);
                }
            }

            $createdFiles[] = $publicFile;
        }

        return PublicFileResource::collection(collect($createdFiles));
    }
}
