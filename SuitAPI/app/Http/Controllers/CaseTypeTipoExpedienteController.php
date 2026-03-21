<?php

namespace App\Http\Controllers;

use App\Http\Resources\TipoExpedienteResource;
use App\Models\CaseType;
use Illuminate\Support\Facades\Gate;

class CaseTypeTipoExpedienteController extends Controller
{
    public function index(CaseType $caseType)
    {
        Gate::authorize('viewAny', \App\Models\TipoExpediente::class);

        $tipoExpedientes = $caseType->tipoExpedientes;

        return TipoExpedienteResource::collection($tipoExpedientes);
    }
}
