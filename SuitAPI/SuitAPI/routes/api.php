<?php

use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/is_on', function () { // DOCUMENTADA
    return response('OK');
});

Route::post('/login', [AuthController::class, 'login']); // DOCUMENTADA

// Public Signed Routes (Validated by Signature)
Route::get('/public-files/{id}/download-signed', [\App\Http\Controllers\PublicFileController::class, 'downloadSigned'])
    ->name('public-files.download-signed');

Route::match(['GET', 'POST'], '/public-files/upload-signed', [\App\Http\Controllers\PublicFileController::class, 'uploadSigned'])
    ->name('public-files.upload-signed');

Route::get('/suit-cases/download-signed', [\App\Http\Controllers\CaseLinkController::class, 'downloadSigned'])
    ->name('cases.download-signed');

Route::match(['GET', 'POST'], '/suit-cases/upload-signed', [\App\Http\Controllers\CaseLinkController::class, 'uploadSigned'])
    ->name('cases.upload-signed');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/register', [AuthController::class, 'register']); // DOCUMENTADA
    Route::post('/logout', [AuthController::class, 'logout']); // DOCUMENTADA
    Route::get('/user', function (Request $request) { // DOCUMENTADA
        return $request->user();
    });

    // Last-Modified Cache Check Routes
    Route::get('/cases/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'casesLastModified']); // DOCUMENTADA
    Route::get('/cases/{case}/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'caseLastModified']); // DOCUMENTADA
    Route::get('/documents/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'documentsLastModified']); // DOCUMENTADA
    Route::get('/documents/{document}/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'documentLastModified']); // DOCUMENTADA
    Route::get('/clients/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'clientsLastModified']); // DOCUMENTADA
    Route::get('/clients/{client}/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'clientLastModified']); // DOCUMENTADA
    Route::get('/users/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'usersLastModified']); // DOCUMENTADA
    Route::get('/users/{user}/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'userLastModified']); // DOCUMENTADA
    Route::get('/agendas/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'agendasLastModified']); // DOCUMENTADA
    Route::get('/agenda/{agenda}/last-modified/{month}/{year}', [\App\Http\Controllers\LastModifiedController::class, 'agendaMonthLastModified']) // DOCUMENTADA
        ->whereNumber('agenda')
        ->whereNumber('month')
        ->whereNumber('year');
    Route::get('/event-types/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'eventTypesLastModified']); // DOCUMENTADA
    Route::get('/templates/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'templatesLastModified']); // DOCUMENTADA
    Route::get('/template-categories/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'templateCategoriesLastModified']); // DOCUMENTADA
    Route::get('/partes/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'partesLastModified']); // DOCUMENTADA

    Route::apiResource('agendas', \App\Http\Controllers\AgendaController::class)->only(['index']); // DOCUMENTADA
    Route::get('/agendas/status/{id}', [\App\Http\Controllers\AgendaController::class, 'status']); // DOCUMENTADA
    Route::get('/agendas/latest-event', [\App\Http\Controllers\AgendaController::class, 'latestEvent']); // DOCUMENTADA
    Route::get('/agendas/sync', [\App\Http\Controllers\AgendaController::class, 'syncDown']); // DOCUMENTADA
    Route::post('/agendas/sync', [\App\Http\Controllers\AgendaController::class, 'syncUp']); // DOCUMENTADA
    Route::get('/agendas/all-events', [\App\Http\Controllers\AgendaController::class, 'allEvents']); // DOCUMENTADA
    Route::get('/agendas/all-events/last-modified/{month?}/{year?}', [\App\Http\Controllers\LastModifiedController::class, 'allEventsLastModified']) // DOCUMENTADA
        ->whereNumber('month')
        ->whereNumber('year');
    Route::get('/agendas/all-events/{month}/{year}', [\App\Http\Controllers\AgendaController::class, 'allEvents']) // DOCUMENTADA
        ->whereNumber('month')
        ->whereNumber('year');
    Route::get('/agenda/{agenda}', [\App\Http\Controllers\AgendaController::class, 'agendaEvents']) // DOCUMENTADA
        ->whereNumber('agenda');
    Route::get('/agenda/{agenda}/{month}/{year}', [\App\Http\Controllers\AgendaController::class, 'agendaEventsByMonth']) // DOCUMENTADA
        ->whereNumber('agenda')
        ->whereNumber('month')
        ->whereNumber('year');

    // Filtrar todos los eventos por tipo de evento
    Route::get('/agendas/all-events/type/{eventType}/{month}/{year}', [\App\Http\Controllers\AgendaController::class, 'allEventsByType']) // DOCUMENTADA
        ->whereNumber('eventType')
        ->whereNumber('month')
        ->whereNumber('year');
    Route::get('/agendas/all-events/vencimientos/{month}/{year}', [\App\Http\Controllers\AgendaController::class, 'allVencimientos']) // DOCUMENTADA
        ->whereNumber('month')
        ->whereNumber('year');

    // Vencimientos
    Route::get('/vencimientos/last-modified/{month}/{year}', [\App\Http\Controllers\LastModifiedController::class, 'deadlinesLastModified'])
        ->whereNumber('month')
        ->whereNumber('year');
    Route::get('/vencimientos/{month}/{year}', [\App\Http\Controllers\DeadlineController::class, 'index']) // DOCUMENTADA
        ->whereNumber('month')
        ->whereNumber('year');
    Route::post('/vencimientos', [\App\Http\Controllers\DeadlineController::class, 'store']); // DOCUMENTADA
    Route::get('/vencimientos/{deadline}', [\App\Http\Controllers\DeadlineController::class, 'show']); // DOCUMENTADA
    Route::put('/vencimientos/{deadline}', [\App\Http\Controllers\DeadlineController::class, 'update']); // DOCUMENTADA
    Route::delete('/vencimientos/{deadline}', [\App\Http\Controllers\DeadlineController::class, 'destroy']); // DOCUMENTADA
    Route::post('/vencimientos/{deadline}/completar', [\App\Http\Controllers\DeadlineController::class, 'completar']); // DOCUMENTADA
    Route::post('/vencimientos/{deadline}/prorrogar', [\App\Http\Controllers\DeadlineController::class, 'prorrogar']); // DOCUMENTADA

    // Sync-Down routes: fetch incrementally changed records since a given timestamp
    Route::get('/suit-cases/sync', [\App\Http\Controllers\CaseController::class, 'syncDown']);
    Route::get('/cases/{case}/syncDown/{date}', [\App\Http\Controllers\CaseController::class, 'caseSyncDown']);
    Route::get('/clients/sync', [\App\Http\Controllers\ClientController::class, 'syncDown']);
    Route::get('/documents/sync', [\App\Http\Controllers\DocumentController::class, 'syncDown']);
    Route::get('/templates/sync', [\App\Http\Controllers\TemplateController::class, 'syncDown']);
    Route::get('/template-categories/sync', [\App\Http\Controllers\TemplateCategoryController::class, 'syncDown']);
    Route::get('/partes/sync', [\App\Http\Controllers\ParteController::class, 'syncDown']); // DOCUMENTADA

    // Sync-Up routes: bulk update/create from offline client
    Route::post('/suit-cases/sync', [\App\Http\Controllers\CaseController::class, 'syncUp']);
    Route::post('/clients/sync', [\App\Http\Controllers\ClientController::class, 'syncUp']);
    Route::post('/documents/sync', [\App\Http\Controllers\DocumentController::class, 'syncUp']);
    Route::post('/templates/sync', [\App\Http\Controllers\TemplateController::class, 'syncUp']);
    Route::post('/template-categories/sync', [\App\Http\Controllers\TemplateCategoryController::class, 'syncUp']);

    Route::get('/cases/open', [\App\Http\Controllers\CaseController::class, 'openCases']); // DOCUMENTADA
    Route::get('/cases/closed', [\App\Http\Controllers\CaseController::class, 'closedCases']); // DOCUMENTADA
    Route::apiResource('cases', \App\Http\Controllers\CaseController::class); // DOCUMENTADA
    Route::post('/cases/{id}/participants', [\App\Http\Controllers\CaseController::class, 'addParticipant']); // DOCUMENTADA
    Route::delete('/cases/{id}/participants/{user_id}', [\App\Http\Controllers\CaseController::class, 'removeParticipant']); // DOCUMENTADA
    Route::get('/cases/{id}/participants', [\App\Http\Controllers\CaseController::class, 'getParticipants']); // DOCUMENTADA
    Route::post('/cases/{id}/close', [\App\Http\Controllers\CaseController::class, 'close']); // DOCUMENTADA
    Route::post('/cases/{id}/reopen', [\App\Http\Controllers\CaseController::class, 'reopen']); // DOCUMENTADA
    Route::get('/cases/{id}/agenda', [\App\Http\Controllers\CaseController::class, 'getAgenda']);

    // Case Link Generation
    Route::post('/suit-cases/{id}/generate-link', [\App\Http\Controllers\CaseLinkController::class, 'generateLink']);

    // Case Types
    Route::apiResource('case-types', \App\Http\Controllers\CaseTypeController::class)->only(['index', 'store', 'update', 'destroy']); // DOCUMENTADA
    Route::apiResource('event-types', \App\Http\Controllers\EventTypeController::class)->only(['index', 'store', 'update', 'destroy']); // DOCUMENTADA

    Route::get('/users/search', [\App\Http\Controllers\UserController::class, 'search']); // DOCUMENTADA
    Route::get('/users', [\App\Http\Controllers\UserController::class, 'index']); // DOCUMENTADA
    Route::get('/users/{user}', [\App\Http\Controllers\UserController::class, 'show']);
    Route::delete('/users/{user}', [\App\Http\Controllers\UserController::class, 'destroy']);
    Route::put('/users/tag/{user:tag}', [\App\Http\Controllers\UserController::class, 'updateByTag']);
    Route::put('/user/profile', [\App\Http\Controllers\UserController::class, 'updateProfile']); // DOCUMENTADA
    Route::post('/user/profile-photo', [\App\Http\Controllers\UserController::class, 'uploadProfilePhoto']); // DOCUMENTADA

    Route::get('/notifications', [\App\Http\Controllers\EventNotificationController::class, 'index']); // DOCUMENTADA
    Route::get('/notifications/sync', [\App\Http\Controllers\EventNotificationController::class, 'syncDown']); // DOCUMENTADA
    Route::post('/notifications/sync', [\App\Http\Controllers\EventNotificationController::class, 'syncUp']); // DOCUMENTADA
    Route::get('/notifications/until-today', [\App\Http\Controllers\EventNotificationController::class, 'untilToday']); // DOCUMENTADA
    Route::get('/notifications/last-modified', [\App\Http\Controllers\EventNotificationController::class, 'lastModified']); // DOCUMENTADA

    Route::apiResource('events', \App\Http\Controllers\EventController::class); // DOCUMENTADA
    Route::get('/events/{event}/notification', [\App\Http\Controllers\EventNotificationController::class, 'show']); // DOCUMENTADA
    Route::post('/events/{event}/notification', [\App\Http\Controllers\EventNotificationController::class, 'store']); // DOCUMENTADA
    Route::put('/events/{event}/notification', [\App\Http\Controllers\EventNotificationController::class, 'update']); // DOCUMENTADA
    Route::delete('/events/{event}/notification', [\App\Http\Controllers\EventNotificationController::class, 'destroy']); // DOCUMENTADA

    // Document Routes
    Route::get('/documents/total-pages', [\App\Http\Controllers\DocumentController::class, 'totalPages']); // DOCUMENTADA
    Route::get('/documents/total-pages-filtered', [\App\Http\Controllers\DocumentController::class, 'totalPagesFiltered']); // DOCUMENTADA
    Route::get('/documents/search', [\App\Http\Controllers\DocumentController::class, 'search']); // DOCUMENTADA
    Route::get('/documents/paged-filtered', [\App\Http\Controllers\DocumentController::class, 'pagedFiltered']); // DOCUMENTADA
    Route::get('/documents', [\App\Http\Controllers\DocumentController::class, 'index']); // DOCUMENTADA
    Route::post('/documents', [\App\Http\Controllers\DocumentController::class, 'store']); // DOCUMENTADA
    Route::get('/documents/{document}', [\App\Http\Controllers\DocumentController::class, 'show']); // Download
    Route::put('/documents/{document}', [\App\Http\Controllers\DocumentController::class, 'update']);
    Route::delete('/documents/{document}', [\App\Http\Controllers\DocumentController::class, 'destroy']);
    Route::get('/documents/{document}/versions', [\App\Http\Controllers\DocumentController::class, 'versions']); // DOCUMENTADA
    Route::get('/documents/{document}/versions/{versionNumber}', [\App\Http\Controllers\DocumentController::class, 'showVersion'])->whereNumber('versionNumber'); // DOCUMENTADA
    Route::post('/documents/{document}/lock', [\App\Http\Controllers\DocumentController::class, 'lock']);
    Route::post('/documents/{document}/unlock', [\App\Http\Controllers\DocumentController::class, 'unlock']);
    Route::patch('/documents/{document}/status', [\App\Http\Controllers\DocumentController::class, 'updateStatus']);
    Route::patch('/documents/{document}/name', [\App\Http\Controllers\DocumentController::class, 'updateName']);
    Route::get('/documents/{document}/is-locked', [\App\Http\Controllers\DocumentController::class, 'isLocked']); // DOCUMENTADA
    Route::get('/documents/{document}/last-modified', [\App\Http\Controllers\DocumentController::class, 'lastModified']); // DOCUMENTADA

    // Client Routes
    Route::apiResource('clients', \App\Http\Controllers\ClientController::class); // DOCUMENTADA
    Route::get('/cases/{case}/clients', [\App\Http\Controllers\ClientController::class, 'getForCase']);
    Route::post('/cases/{case}/clients', [\App\Http\Controllers\ClientController::class, 'attachCase']);
    Route::delete('/cases/{case}/clients/{client}', [\App\Http\Controllers\ClientController::class, 'detachCase']);
    Route::post('/documents/{document}/clients', [\App\Http\Controllers\ClientController::class, 'attachDocument']);
    Route::delete('/documents/{document}/clients/{client}', [\App\Http\Controllers\ClientController::class, 'detachDocument']);

    // Template Categories
    Route::apiResource('template-categories', \App\Http\Controllers\TemplateCategoryController::class); // DOCUMENTADA
    Route::get('/template-categories/{templateCategory}/templates-list', [\App\Http\Controllers\TemplateCategoryController::class, 'templatesList']);

    // Templates
    Route::apiResource('templates', \App\Http\Controllers\TemplateController::class);
    Route::get('/templates/{template}/requirements/last-modified', [\App\Http\Controllers\RequisitoController::class, 'templateRequirementsLastModified']);

    // Requisitos
    Route::get('/requisitos/last-modified', [\App\Http\Controllers\RequisitoController::class, 'lastModified']);
    Route::get('/requisitos/sync', [\App\Http\Controllers\RequisitoController::class, 'syncDown']);
    Route::apiResource('requisitos', \App\Http\Controllers\RequisitoController::class);

    // Multimedia Routes
    Route::post('/multimedia', [\App\Http\Controllers\MultimediaController::class, 'store']); // DOCUMENTADA
    Route::get('/multimedia', [\App\Http\Controllers\MultimediaController::class, 'index']); // DOCUMENTADA
    Route::get('/multimedia/{multimedia}', [\App\Http\Controllers\MultimediaController::class, 'show']);
    Route::delete('/multimedia/{multimedia}', [\App\Http\Controllers\MultimediaController::class, 'destroy']);

    // File Routes
    Route::post('/files', [\App\Http\Controllers\FileController::class, 'store']);
    Route::get('/files', [\App\Http\Controllers\FileController::class, 'index']);
    Route::get('/files/{file}', [\App\Http\Controllers\FileController::class, 'show']);
    Route::delete('/files/{file}', [\App\Http\Controllers\FileController::class, 'destroy']);

    // Honorarios
    Route::get('/honorarios/by-date-range', [\App\Http\Controllers\HonorarioController::class, 'byDateRange']); // DOCUMENTADA
    Route::get('/suit-cases/{suit_case}/honorarios', [\App\Http\Controllers\HonorarioController::class, 'indexByCase']); // DOCUMENTADA
    Route::post('/suit-cases/{suit_case}/honorarios', [\App\Http\Controllers\HonorarioController::class, 'store']); // DOCUMENTADA
    Route::get('/clients/{client}/honorarios', [\App\Http\Controllers\HonorarioController::class, 'indexByClient']); // DOCUMENTADA
    Route::get('/honorarios/{honorario}', [\App\Http\Controllers\HonorarioController::class, 'show']); // DOCUMENTADA
    Route::put('/honorarios/{honorario}', [\App\Http\Controllers\HonorarioController::class, 'update']); // DOCUMENTADA
    Route::delete('/honorarios/{honorario}', [\App\Http\Controllers\HonorarioController::class, 'destroy']); // DOCUMENTADA

    // Entregas
    Route::get('/honorarios/{honorario}/entregas', [\App\Http\Controllers\EntregaController::class, 'indexByHonorario']); // DOCUMENTADA
    Route::post('/honorarios/{honorario}/entregas', [\App\Http\Controllers\EntregaController::class, 'store']); // DOCUMENTADA
    Route::get('/entregas/{entrega}', [\App\Http\Controllers\EntregaController::class, 'show']); // DOCUMENTADA
    Route::put('/entregas/{entrega}', [\App\Http\Controllers\EntregaController::class, 'update']); // DOCUMENTADA
    Route::delete('/entregas/{entrega}', [\App\Http\Controllers\EntregaController::class, 'destroy']); // DOCUMENTADA

    // Gastos y GastoSuitCase
    Route::get('/gasto-suit-cases/by-date-range', [\App\Http\Controllers\GastoSuitCaseController::class, 'byDateRange']); // DOCUMENTADA
    Route::get('/suit-cases/{suit_case}/gastos', [\App\Http\Controllers\GastoSuitCaseController::class, 'indexByCase']); // DOCUMENTADA
    Route::post('/suit-cases/{suit_case}/gastos', [\App\Http\Controllers\GastoSuitCaseController::class, 'store']); // DOCUMENTADA
    Route::get('/gasto-suit-cases/{gasto_suit_case}', [\App\Http\Controllers\GastoSuitCaseController::class, 'show']); // DOCUMENTADA
    Route::put('/gasto-suit-cases/{gasto_suit_case}', [\App\Http\Controllers\GastoSuitCaseController::class, 'update']); // DOCUMENTADA
    Route::delete('/gasto-suit-cases/{gasto_suit_case}', [\App\Http\Controllers\GastoSuitCaseController::class, 'destroy']); // DOCUMENTADA

    // Catálogos (Gastos, TipoPago, TipoExpediente, Radicacion)
    Route::get('/gastos/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'gastosLastModified']); // DOCUMENTADA
    Route::apiResource('gastos', \App\Http\Controllers\GastoController::class); // DOCUMENTADA
    Route::apiResource('tipo-pagos', \App\Http\Controllers\TipoPagoController::class);

    Route::get('/tipo-expedientes/last-modified', [\App\Http\Controllers\LastModifiedController::class, 'tipoExpedientesLastModified']);
    Route::get('/case-types/{case_type}/tipo-expedientes', [\App\Http\Controllers\CaseTypeTipoExpedienteController::class, 'index']);
    Route::apiResource('tipo-expedientes', \App\Http\Controllers\TipoExpedienteController::class);
    Route::get('/suit-cases/{suit_case}/tipo-expedientes', [\App\Http\Controllers\SuitCaseTipoExpedienteController::class, 'index']);
    Route::post('/suit-cases/{suit_case}/tipo-expedientes', [\App\Http\Controllers\SuitCaseTipoExpedienteController::class, 'sync']);

    Route::get('/radicaciones/last-modified', [\App\Http\Controllers\RadicacionController::class, 'lastModified']);
    Route::get('/radicaciones/sync', [\App\Http\Controllers\RadicacionController::class, 'syncDown']);
    Route::apiResource('radicaciones', \App\Http\Controllers\RadicacionController::class)->parameters(['radicaciones' => 'radicacion'])->except(['show']);

    // Judicial Dependencies
    Route::get('/jurisdicciones/last-modified', [\App\Http\Controllers\JurisdiccionController::class, 'lastModified']);
    Route::get('/jurisdicciones/sync', [\App\Http\Controllers\JurisdiccionController::class, 'syncDown']);
    Route::get('/jurisdicciones/{jurisdiccion}/competencias', [\App\Http\Controllers\JurisdiccionController::class, 'getCompetencias']);
    Route::apiResource('jurisdicciones', \App\Http\Controllers\JurisdiccionController::class)->parameters(['jurisdicciones' => 'jurisdiccion']);

    Route::get('/competencias/last-modified', [\App\Http\Controllers\CompetenciaController::class, 'lastModified']);
    Route::get('/competencias/sync', [\App\Http\Controllers\CompetenciaController::class, 'syncDown']);
    Route::apiResource('competencias', \App\Http\Controllers\CompetenciaController::class);

    Route::get('/dependencias-judiciales/last-modified', [\App\Http\Controllers\DependenciaJudicialController::class, 'lastModified']);
    Route::get('/dependencias-judiciales/sync', [\App\Http\Controllers\DependenciaJudicialController::class, 'syncDown']);
    Route::apiResource('dependencias-judiciales', \App\Http\Controllers\DependenciaJudicialController::class)->parameters(['dependencias-judiciales' => 'dependenciaJudicial']);

    // Roles y Partes (personas involucradas en casos)
    Route::apiResource('roles', \App\Http\Controllers\RolController::class)->parameters(['roles' => 'rol']);
    Route::apiResource('partes', \App\Http\Controllers\ParteController::class);

    // Partes asociadas a un caso
    Route::get('/suit-cases/{suit_case}/partes', [\App\Http\Controllers\ParteCasoController::class, 'index']);
    Route::post('/suit-cases/{suit_case}/partes', [\App\Http\Controllers\ParteCasoController::class, 'store']);
    Route::delete('/suit-cases/{suit_case}/partes/{parte}', [\App\Http\Controllers\ParteCasoController::class, 'destroy']);

    // System Settings (admin only)
    Route::get('/settings', [\App\Http\Controllers\SettingController::class, 'index']);
    Route::put('/settings/{key}', [\App\Http\Controllers\SettingController::class, 'update']);

    // Public Files
    Route::get('/public-files/last-modified', [\App\Http\Controllers\PublicFileController::class, 'lastModified']);
    Route::get('/public-files/sync', [\App\Http\Controllers\PublicFileController::class, 'syncDown']);
    Route::get('/public-files/{id}/download', [\App\Http\Controllers\PublicFileController::class, 'download']);
    Route::get('/public-files/{id}/generate-link', [\App\Http\Controllers\PublicFileController::class, 'generateSignedUrl']);
    Route::post('/public-files/generate-upload-link', [\App\Http\Controllers\PublicFileController::class, 'generateUploadLink']);
    Route::get('/public-file-catalogs/{catalog_id}/public-files', [\App\Http\Controllers\PublicFileController::class, 'indexByCatalog']);
    Route::apiResource('/public-files', \App\Http\Controllers\PublicFileController::class)->parameters([
        'public-files' => 'id',
    ])->except(['index']);

    // Public File Catalogs
    Route::apiResource('/public-file-catalogs', \App\Http\Controllers\PublicFileCatalogController::class)->parameters([
        'public-file-catalogs' => 'id',
    ]);

    // Public File Permissions
    Route::get('/public-files/{id}/permissions', [\App\Http\Controllers\PublicFilePermissionController::class, 'index']);
    Route::get('/public-files/{id}/my-permissions', [\App\Http\Controllers\PublicFilePermissionController::class, 'myPermissions']);
    Route::post('/public-files/{id}/permissions', [\App\Http\Controllers\PublicFilePermissionController::class, 'store']);
    Route::delete('/public-files/{id}/permissions/{user_id}', [\App\Http\Controllers\PublicFilePermissionController::class, 'destroy']);

    // Bitacora (Admin only)
    Route::get('/bitacora', [\App\Http\Controllers\BitacoraController::class, 'index']); // DOCUMENTADA
    Route::delete('/bitacora/clear', [\App\Http\Controllers\BitacoraController::class, 'clear']); // DOCUMENTADA
    Route::delete('/bitacora/cleanup', [\App\Http\Controllers\BitacoraController::class, 'cleanup']); // DOCUMENTADA
});
