<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ChecksForConflict;
use App\Http\Requests\StoreDocumentRequest;
use App\Http\Requests\UpdateDocumentRequest;
use App\Models\Document;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use RuntimeException;
use Symfony\Component\Mime\MimeTypes;

class DocumentController extends Controller
{
    use ChecksForConflict;

    public function __construct(protected DocumentService $documentService) {}

    public function index(Request $request)
    {
        // Use the scopeAccessibleBy to filter documents based on the new logic:
        // - Personal docs (no case) -> Only owner
        // - Case docs -> Only participants of the case (even if I created it, if I'm out of the case, I don't see it)

        $documents = Document::accessibleBy($request->user())
            ->with(['latestVersion.creator', 'locker'])
            ->paginate(15); // Pagination as requested

        return response()->json($documents);
    }

    /**
     * Return all accessible documents (including soft-deleted) modified after the given `since` timestamp.
     * Used by the offline client to fetch only the delta and detect remotely-deleted records.
     */
    public function syncDown(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate(['since' => 'required|date']);

        $since = Carbon::parse($request->since);
        $user = $request->user();

        $documents = Document::withTrashed()
            ->accessibleBy($user)
            ->where('updated_at', '>=', $since)
            ->with(['latestVersion.creator', 'locker'])
            ->get();

        return response()->json($documents);
    }

    /**
     * Receive multiple documents from client offline database to update/create them.
     * For documents, changes in offline mode are typically text edits that must be saved
     * as new versions if conflict-free.
     */
    public function syncUp(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'documents' => 'required|array',
            'documents.*.name' => 'required|string',
            'documents.*.content' => 'required|string', // Plain text content required for sync
        ]);

        $synced = [];
        $conflicts = [];
        $user = $request->user();

        foreach ($request->documents as $docData) {
            try {
                if (isset($docData['id']) && $docData['id']) {
                    // Update: implies saving a new version of the existing document
                    $document = Document::find($docData['id']);
                    if ($document) {
                        try {
                            $this->checkForConflict($document, $docData);

                            // To simulate the file upload from the plain text offline string:
                            $tempFile = tmpfile();
                            fwrite($tempFile, $docData['content']);
                            $path = stream_get_meta_data($tempFile)['uri'];

                            $extension = pathinfo($docData['name'], PATHINFO_EXTENSION) ?: 'txt';
                            $mimeType = match ($extension) {
                                'html' => 'text/html',
                                'json' => 'application/json',
                                default => 'text/plain',
                            };

                            // Mocking an UploadedFile using the string content
                            $uploadedFile = new \Illuminate\Http\UploadedFile(
                                $path,
                                $docData['name'].(str_contains($docData['name'], '.') ? '' : '.'.$extension),
                                $mimeType,
                                null,
                                true
                            );

                            $this->documentService->createVersion($document, $uploadedFile, $user);
                            $document->update(['name' => $docData['name']]);
                            $document->touch();

                            $synced[] = clone $document->load('latestVersion.creator');

                            fclose($tempFile);

                        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                            if ($e->getStatusCode() === 409) {
                                $conflicts[] = $docData['id'];
                            } else {
                                throw $e;
                            }
                        }
                    }
                } else {
                    // Creation requires suit_case_id
                    if (! isset($docData['suit_case_id'])) {
                        continue;
                    }

                    $tempFile = tmpfile();
                    fwrite($tempFile, $docData['content']);
                    $path = stream_get_meta_data($tempFile)['uri'];

                    $extension = pathinfo($docData['name'], PATHINFO_EXTENSION) ?: 'txt';
                    $mimeType = match ($extension) {
                        'html' => 'text/html',
                        'json' => 'application/json',
                        default => 'text/plain',
                    };

                    $uploadedFile = new \Illuminate\Http\UploadedFile(
                        $path,
                        $docData['name'].(str_contains($docData['name'], '.') ? '' : '.'.$extension),
                        $mimeType,
                        null,
                        true
                    );

                    $document = $this->documentService->createDocument(
                        [
                            'name' => $docData['name'],
                            'suit_case_id' => $docData['suit_case_id'],
                            'event_id' => $docData['event_id'] ?? null,
                        ],
                        $uploadedFile,
                        $user
                    );

                    $synced[] = $document->load('latestVersion.creator');
                    fclose($tempFile);
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        return response()->json([
            'synced' => $synced,
            'conflicts' => $conflicts,
        ]);
    }

    public function store(StoreDocumentRequest $request)
    {
        $user = $request->user();

        // Prepare the suitCase model if ID is present
        $suitCase = null;
        if ($request->has('suit_case_id') && $request->suit_case_id) {
            // Find or fail ensures we have a valid model instance or throw a 404
            $suitCase = \App\Models\SuitCase::findOrFail($request->suit_case_id);
        }

        // Authorize creation. We pass the class name and the optional extra argument (the case).
        Gate::authorize('create', [Document::class, $suitCase]);

        $document = $this->documentService->createDocument($request->all(), $request->file('file'), $request->user());

        return response()->json($document->load('latestVersion'), 201);
    }

    public function show(Request $request, Document $document)
    {
        Gate::authorize('view', $document);

        try {
            $version = $document->latestVersion;
            if (! $version) {
                return response()->json(['message' => 'No version found'], 404);
            }

            $content = $this->documentService->getFileContent($version);
            $downloadFilename = $this->resolveDownloadFilename($document, $version->mime_type);

            return response($content, 200, [
                'Content-Type' => $version->mime_type,
                'Content-Disposition' => 'attachment; filename="'.$downloadFilename.'"',
            ]);

        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'Posible corrupción o manipulación de datos') {
                return response()->json(['message' => $e->getMessage()], 500);
            }
            throw $e;
        }
    }

    public function versions(Request $request, Document $document)
    {
        Gate::authorize('view', $document);

        return response()->json($document->versions()->with('creator')->orderBy('version_number', 'desc')->get());
    }

    public function update(UpdateDocumentRequest $request, Document $document)
    {
        Gate::authorize('update', $document);

        $this->checkForConflict($document, $request);

        $user = $request->user();

        // If locked by another user, reject
        if ($document->isLocked() && $document->locked_by !== $user->id) {
            return response()->json(['message' => 'Document is locked by another user'], 403);
        }

        // Save new version
        $version = $this->documentService->createVersionExplicitIV($document, $request->file('file'), $user);

        // Renew/acquire lock for 5 more minutes
        $document->lock($user);

        return response()->json($version->load('creator'), 201);
    }

    protected function resolveDownloadFilename(Document $document, string $mimeType): string
    {
        $currentExtension = strtolower(pathinfo($document->name, PATHINFO_EXTENSION));
        if ($currentExtension !== '') {
            return $document->name;
        }

        $extension = MimeTypes::getDefault()->getExtensions($mimeType)[0] ?? null;

        return $extension ? "{$document->name}.{$extension}" : $document->name;
    }

    public function lock(Request $request, Document $document)
    {
        Gate::authorize('update', $document);

        if ($this->documentService->lockDocument($document, $request->user())) {
            return response()->json(['message' => 'Locked successfully']);
        }

        return response()->json(['message' => 'Could not lock document'], 409);
    }

    public function unlock(Request $request, Document $document)
    {
        Gate::authorize('update', $document);

        if ($this->documentService->unlockDocument($document, $request->user())) {
            return response()->json(['message' => 'Unlocked successfully']);
        }

        return response()->json(['message' => 'Could not unlock document'], 409);
    }

    public function isLocked(Request $request, Document $document)
    {
        Gate::authorize('view', $document);

        return response()->json(['is_locked' => $document->isLocked()]);
    }

    public function lastModified(Request $request, Document $document)
    {
        Gate::authorize('view', $document);

        $latestVersion = $document->latestVersion;

        return response()->json([
            'last_modified' => $latestVersion?->created_at ?? $document->updated_at,
            'user' => $latestVersion?->creator,
        ]);
    }

    public function destroy(Request $request, Document $document)
    {
        Gate::authorize('delete', $document);

        // If locked by someone else, prevent delete
        if ($document->isLocked() && $document->locked_by !== $request->user()->id) {
            return response()->json(['message' => 'Document is locked by another user'], 403);
        }

        $this->documentService->deleteDocument($document);

        return response()->json(null, 204);
    }
}
