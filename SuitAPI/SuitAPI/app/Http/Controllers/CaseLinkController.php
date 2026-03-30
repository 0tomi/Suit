<?php

namespace App\Http\Controllers;

use App\Models\File;
use App\Models\Multimedia;
use App\Models\SuitCase;
use App\Models\User;
use App\Services\BitacoraService;
use App\Services\FileService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\URL;

class CaseLinkController extends Controller
{
    use \App\Traits\HandlesManualSignatures, AuthorizesRequests;

    public function __construct(
        protected FileService $fileService,
        protected BitacoraService $bitacora
    ) {}

    /**
     * Generates a temporary signed URL for downloading or uploading a file/multimedia.
     */
    public function generateLink(Request $request, $id): \Illuminate\Http\JsonResponse
    {
        $suitCase = SuitCase::findOrFail($id);

        $request->validate([
            'type' => ['required', 'string', 'in:download,upload'],
            'model_type' => ['required', 'string', 'in:file,multimedia'],
            'model_id' => ['required_if:type,download', 'integer'],
        ]);

        $type = $request->input('type');
        $modelType = $request->input('model_type');

        if ($type === 'download') {
            // Check if user is participant (view permission)
            $this->authorize('view', $suitCase);

            $modelClass = $modelType === 'file' ? File::class : Multimedia::class;
            $model = $modelClass::where('suit_case_id', $suitCase->id)->findOrFail($request->input('model_id'));

            $expiresAt = now()->addMinutes(5);
            $url = $this->createManualSignedUrl(
                'cases.download-signed',
                5,
                [
                    'model_type' => $modelType,
                    'model_id' => $model->id,
                ]
            );

            return response()->json([
                'download_url' => $url,
                'expires_at' => $expiresAt->toIso8601String(),
            ]);
        }

        if ($type === 'upload') {
            // Check if user has write permission (update permission)
            $this->authorize('update', $suitCase);

            $expiresAt = now()->addMinutes(15);
            $url = $this->createManualSignedUrl(
                'cases.upload-signed',
                15,
                [
                    'case_id' => $suitCase->id,
                    'model_type' => $modelType,
                    'generator_id' => Auth::id(),
                ]
            );

            return response()->json([
                'upload_url' => $url,
                'expires_at' => $expiresAt->toIso8601String(),
            ]);
        }

        return response()->json(['message' => 'Tipo de solicitud inválido.'], 400);
    }

    /**
     * Handles signed download.
     */
    public function downloadSigned(Request $request)
    {
        $this->validateManualSignature($request, 'cases.download-signed');

        $modelType = $request->input('model_type');
        $modelId = $request->input('model_id');

        $modelClass = $modelType === 'file' ? File::class : Multimedia::class;
        $model = $modelClass::findOrFail($modelId);

        if ($request->query('confirmed') !== '1') {
            $isMultimedia = $modelType === 'multimedia';

            return view('download', [
                'context' => $modelType,
                'title' => $isMultimedia ? 'Multimedia de Caso' : 'Archivo de Caso',
                'description' => 'Descarga segura de '.($isMultimedia ? 'multimedia' : 'documento').' del caso.',
                'filename' => $model->filename,
                'filesize' => number_format($model->size / 1024 / 1024, 2).' MB',
            ]);
        }

        $content = $this->fileService->getFileContent($model);

        return response($content, 200, [
            'Content-Type' => $model->mime_type,
            'Content-Disposition' => 'attachment; filename="'.$model->filename.'"',
        ]);
    }

    /**
     * Handles signed upload for multiple files.
     */
    public function uploadSigned(Request $request): \Illuminate\Http\Response|\Illuminate\Http\JsonResponse|\Illuminate\Contracts\View\View
    {
        $this->validateManualSignature($request, 'cases.upload-signed');

        if ($request->isMethod('GET')) {
            $modelType = $request->input('model_type');
            $isMultimedia = $modelType === 'multimedia';

            return view('upload', [
                'context' => $modelType,
                'title' => $isMultimedia ? 'Multimedia de Caso' : 'Archivos de Caso',
                'description' => 'Carga uno o más '.($isMultimedia ? 'archivos multimedia' : 'documentos').' directamente a este caso desde tu teléfono.',
                'accept' => $isMultimedia
                    ? '.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.avi,.mkv'
                    : '.pdf,.doc,.docx,.xls,.xlsx,.csv',
                'allowed_formats' => $isMultimedia
                    ? 'Imágenes y Videos'
                    : 'Documentos y hojas de cálculo (PDF, Word, Excel)',
            ]);
        }

        $modelType = $request->input('model_type');
        $mimes = $modelType === 'multimedia'
            ? 'jpg,jpeg,png,webp,gif,mp4,mov,avi,mkv'
            : 'pdf,doc,docx,xls,xlsx,csv';

        $request->validate([
            'files' => ['required', 'array'],
            'files.*' => ['file', "mimes:{$mimes}"],
        ]);

        $caseId = $request->input('case_id');
        $generatorId = $request->input('generator_id');

        $user = User::findOrFail($generatorId);
        $files = $request->file('files');
        $createdRecords = [];

        foreach ($files as $file) {
            $data = ['suit_case_id' => $caseId];

            if ($modelType === 'file') {
                $fileRecord = $this->fileService->storeFile($file, $data, $user);
                $this->bitacora->record('uploaded', $fileRecord, $user);
                $createdRecords[] = $fileRecord;
            } else {
                $multimediaRecord = $this->fileService->storeMultimedia($file, $data, $user);
                $this->bitacora->record('uploaded', $multimediaRecord, $user);
                $createdRecords[] = $multimediaRecord;
            }
        }

        return response()->json($createdRecords, 201);
    }
}
