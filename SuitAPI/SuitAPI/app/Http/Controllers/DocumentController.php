<?php

namespace App\Http\Controllers;

use App\Enums\DocumentStatus;
use App\Http\Concerns\ChecksForConflict;
use App\Http\Requests\StoreDocumentRequest;
use App\Http\Requests\UpdateDocumentNameRequest;
use App\Http\Requests\UpdateDocumentRequest;
use App\Http\Resources\DocumentVersionResource;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Services\BitacoraService;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\Mime\MimeTypes;

class DocumentController extends Controller
{
    use ChecksForConflict;

    public function __construct(
        protected DocumentService $documentService,
        protected BitacoraService $bitacora
    ) {}

    public function index(Request $request)
    {
        // Use the scopeAccessibleBy to filter documents based on the new logic:
        // - Personal docs (no case) -> Only owner
        // - Case docs -> Only participants of the case (even if I created it, if I'm out of the case, I don't see it)

        $documents = Document::accessibleBy($request->user())
            ->sort($request->sort_by, $request->sort_direction)
            ->with(['latestVersion.creator', 'locker'])
            ->paginate(15); // Pagination as requested

        return response()->json($documents);
    }

    /**
     * Get the total number of pages for documents based on current access.
     */
    public function totalPages(Request $request): \Illuminate\Http\JsonResponse
    {
        $total = Document::accessibleBy($request->user())->count();
        $perPage = 15;
        $totalPages = ceil($total / $perPage);

        return response()->json([
            'total_documents' => $total,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ]);
    }

    /**
     * Get the total number of pages for documents applying specific filters.
     */
    public function totalPagesFiltered(Request $request): \Illuminate\Http\JsonResponse
    {
        $query = Document::accessibleBy($request->user());

        $this->applyFilters($query, $request);

        $total = $query->count();
        $perPage = 15;
        $totalPages = ceil($total / $perPage);

        return response()->json([
            'total_documents' => $total,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
        ]);
    }

    /**
     * Search for documents with filters. Returns the first 10 matches.
     */
    public function search(Request $request): \Illuminate\Http\JsonResponse
    {
        $query = Document::accessibleBy($request->user());

        if ($request->has('search')) {
            $query->where('name', 'like', '%'.$request->search.'%');
        }

        $this->applyFilters($query, $request);

        $documents = $query->sort($request->sort_by, $request->sort_direction)
            ->with(['latestVersion.creator', 'locker'])
            ->limit(10)
            ->get();

        return response()->json($documents);
    }

    /**
     * Get documents with pagination and filters.
     */
    public function pagedFiltered(Request $request): \Illuminate\Http\JsonResponse
    {
        $query = Document::accessibleBy($request->user());

        $this->applyFilters($query, $request);

        $documents = $query->sort($request->sort_by, $request->sort_direction)
            ->with(['latestVersion.creator', 'locker'])
            ->paginate(15);

        return response()->json($documents);
    }

    /**
     * Apply common filters to the document query.
     */
    protected function applyFilters($query, Request $request): void
    {
        $user = $request->user();

        // only admins can filter by specific user
        if ($request->has('byUser') && $user->isAdmin()) {
            $query->where('user_id', $request->byUser);
        }

        // filter by case with security check
        if ($request->has('suit_case_id')) {
            $suitCase = \App\Models\SuitCase::find($request->suit_case_id);

            // If the user cannot view the case, they cannot see its documents
            if ($suitCase && Gate::allows('view', $suitCase)) {
                $query->where('suit_case_id', $request->suit_case_id);
            } else {
                // If no access or not found, ensure no results are returned for this filter
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->has('client')) {
            $query->whereHas('clients', function ($q) use ($request) {
                $q->where('clients.id', $request->client);
            });
        }

        if ($request->has('state')) {
            $query->where('status', $request->state);
        }
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
                    $document = Document::find($docData['id']);
                    if ($document) {
                        try {
                            $this->checkForConflict($document, $docData);

                            $this->documentService->createVersionFromString($document, $docData['content'], $user);
                            $document->update(['name' => $docData['name']]);
                            $document->touch();

                            $this->bitacora->record('updated', $document, $user);

                            $synced[] = clone $document->load('latestVersion.creator');

                        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
                            if ($e->getStatusCode() === 409) {
                                $conflicts[] = $docData['id'];
                            } else {
                                throw $e;
                            }
                        }
                    }
                } else {
                    if (! isset($docData['suit_case_id'])) {
                        continue;
                    }

                    $document = $this->documentService->createDocument(
                        [
                            'name' => $docData['name'],
                            'suit_case_id' => $docData['suit_case_id'],
                            'event_id' => $docData['event_id'] ?? null,
                        ],
                        $docData['content'],
                        $user
                    );

                    $this->bitacora->record('created', $document, $user);

                    $synced[] = $document->load('latestVersion.creator');
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

        $suitCase = null;
        if ($request->has('suit_case_id') && $request->suit_case_id) {
            $suitCase = \App\Models\SuitCase::findOrFail($request->suit_case_id);
        }

        Gate::authorize('create', [Document::class, $suitCase]);

        $document = $this->documentService->createDocument($request->all(), $request->input('content'), $user);

        $this->bitacora->record('created', $document, $user);

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

    public function versions(Request $request, Document $document): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        Gate::authorize('view', $document);

        $versions = $document->versions()->with('creator')->orderBy('version_number', 'desc')->get();

        return DocumentVersionResource::collection($versions);
    }

    /**
     * Download the raw HTML content of a specific version number.
     * If the file was archived, the archive service handles decompression transparently.
     */
    public function showVersion(Request $request, Document $document, int $versionNumber): mixed
    {
        Gate::authorize('view', $document);

        $version = DocumentVersion::where('document_id', $document->id)
            ->where('version_number', $versionNumber)
            ->firstOrFail();

        try {
            $content = $this->documentService->getFileContent($version);
            $downloadFilename = $this->resolveDownloadFilename($document, $version->mime_type);

            return response($content, 200, [
                'Content-Type' => $version->mime_type,
                'Content-Disposition' => 'inline; filename="'.$downloadFilename.'"',
            ]);
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'Posible corrupción o manipulación de datos') {
                return response()->json(['message' => $e->getMessage()], 500);
            }
            throw $e;
        }
    }

    public function update(UpdateDocumentRequest $request, Document $document)
    {
        Gate::authorize('update', $document);

        $user = $request->user();

        // If locked by another user, reject
        if ($document->isLocked() && $document->locked_by !== $user->id) {
            return response()->json(['message' => 'Document is locked by another user'], 403);
        }

        // Save a new encrypted version with the updated HTML content
        $version = $this->documentService->createVersionFromString($document, $request->input('content'), $user);

        // Renew/acquire lock for 5 more minutes
        $document->lock($user);

        $this->bitacora->record('updated', $document, $user);

        return response()->json($version->load('creator'), 201);
    }

    public function updateStatus(Request $request, Document $document)
    {
        Gate::authorize('update', $document);

        $request->validate([
            'status' => ['required', Rule::enum(DocumentStatus::class)],
        ]);

        $document->update(['status' => $request->status]);

        $this->bitacora->record('status_updated', $document, $request->user());

        return response()->json($document->load(['latestVersion.creator', 'locker']));
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
            $this->bitacora->record('locked', $document, $request->user());

            return response()->json(['message' => 'Locked successfully']);
        }

        return response()->json(['message' => 'Could not lock document'], 409);
    }

    public function unlock(Request $request, Document $document)
    {
        Gate::authorize('update', $document);

        if ($this->documentService->unlockDocument($document, $request->user())) {
            $this->bitacora->record('unlocked', $document, $request->user());

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

    public function updateName(UpdateDocumentNameRequest $request, Document $document)
    {
        Gate::authorize('update', $document);

        if ($document->isLocked()) {
            return response()->json(['message' => 'Document is locked'], 403);
        }

        $document->update(['name' => $request->name]);

        $this->bitacora->record('name_updated', $document, $request->user());

        return response()->json($document->load(['latestVersion.creator', 'locker']));
    }

    public function destroy(Request $request, Document $document)
    {
        Gate::authorize('delete', $document);

        // If locked by someone else, prevent delete
        if ($document->isLocked() && $document->locked_by !== $request->user()->id) {
            return response()->json(['message' => 'Document is locked by another user'], 403);
        }

        $this->documentService->deleteDocument($document);

        $this->bitacora->record('deleted', $document, $request->user());

        return response()->json(null, 204);
    }
}
