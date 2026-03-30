<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AiAuditController extends Controller
{
    /**
     * Lista todas las conversaciones de todos los usuarios (paginado).
     */
    public function index(Request $request): JsonResponse
    {
        if (! auth()->user()?->isAdmin()) {
            abort(403, 'Unauthorized.');
        }

        $conversations = DB::table('agent_conversations')
            ->latest('updated_at')
            ->paginate(30);

        // Agregamos un campo virtual extract_summary
        $conversations->getCollection()->transform(function ($conversation) {
            $firstMessage = DB::table('agent_conversation_messages')
                ->where('conversation_id', $conversation->id)
                ->where('role', 'user')
                ->oldest('created_at')
                ->first();

            $conversation->summary = $firstMessage ? substr($firstMessage->content, 0, 100).'...' : 'Sin mensajes';

            return $conversation;
        });

        return response()->json($conversations);
    }

    /**
     * Ver los mensajes de una conversación específica.
     */
    public function show(string $id): JsonResponse
    {
        if (! auth()->user()?->isAdmin()) {
            abort(403, 'Unauthorized.');
        }

        $conversation = DB::table('agent_conversations')->where('id', $id)->first();
        if (! $conversation) {
            abort(404, 'Conversación no encontrada.');
        }

        $messages = DB::table('agent_conversation_messages')
            ->where('conversation_id', $id)
            ->oldest('created_at')
            ->get();

        $conversation->messages = $messages;

        return response()->json($conversation);
    }
}
