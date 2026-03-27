<?php

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);

        $middleware->api(prepend: [
            \App\Http\Middleware\forceJsonResponse::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                $message = 'El recurso solicitado no fue encontrado.';

                $previous = $e->getPrevious();
                if ($previous instanceof ModelNotFoundException) {
                    $modelClass = class_basename($previous->getModel());

                    $modelNames = [
                        'Document' => 'documento',
                        'SuitCase' => 'caso',
                        'Client' => 'cliente',
                        'User' => 'usuario',
                        'Event' => 'evento',
                        'Template' => 'plantilla',
                        'TemplateCategory' => 'categoría de plantilla',
                        'CaseType' => 'tipo de caso',
                        'Agenda' => 'agenda',
                        'Honorario' => 'honorario',
                        'Entrega' => 'entrega',
                        'GastoSuitCase' => 'gasto',
                        'Rol' => 'rol',
                        'Parte' => 'parte',
                    ];

                    $name = $modelNames[$modelClass] ?? $modelClass;
                    $message = "No se encontró el {$name} solicitado.";
                }

                return response()->json([
                    'message' => $message,
                ], 404);
            }
        });

        $exceptions->render(function (InvalidSignatureException $e, Request $request) {
            // Si es un GET a una ruta de subida firmada, priorizamos la vista HTML
            // ignorando el encabezado 'Accept' forzado por el middleware.
            if ($request->isMethod('GET') && (str_contains($request->url(), 'upload-signed'))) {
                return response()->view('errors.invalid-signature', [], 403);
            }

            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'El enlace no es válido o ha expirado.',
                ], 403);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                $message = $e->getMessage() && $e->getMessage() !== 'This action is unauthorized.'
                    ? $e->getMessage()
                    : 'Permisos insuficientes para realizar esta acción.';

                return response()->json([
                    'message' => $message,
                ], 403);
            }
        });
    })->create();
