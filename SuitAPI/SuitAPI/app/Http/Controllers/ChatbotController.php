<?php

namespace App\Http\Controllers;

use App\Ai\Agents\PlantillaAgent;
use App\Http\Requests\SendChatMessageRequest;
use App\Http\Requests\StartConversationRequest;
use App\Services\AiConfigService;
use App\Services\ConversationTemplateStateService;
use App\Services\HtmlSimplifierService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Ai\Contracts\ConversationStore;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatbotController extends Controller
{
    public function __construct(
        private AiConfigService $aiConfig,
        private ConversationTemplateStateService $conversationTemplateState,
        private HtmlSimplifierService $htmlSimplifier,
    ) {}

    /**
     * Devuelve la lista de conversaciones del usuario autenticado.
     */
    public function index(Request $request)
    {
        $conversations = DB::table('agent_conversations')
            ->where('user_id', $request->user()->id)
            ->latest('updated_at')
            ->paginate(15);

        return response()->json($conversations);
    }

    /**
     * Muestra una conversación específica y sus mensajes.
     */
    public function show(string $id, Request $request)
    {
        $conversation = DB::table('agent_conversations')
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

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

    /**
     * Inicia una nueva conversación con un documento HTML (opcional) y un prompt inicial.
     */
    public function start(StartConversationRequest $request): StreamedResponse
    {
        $config = $this->aiConfig->applyConfigToRuntime();

        $prompt = $request->validated('prompt');
        $html = $request->validated('html_content');

        if ($html !== null) {
            $toonHtml = $this->htmlSimplifier->toToon($html);
            $prompt .= "\n\n=== DOCUMENTO A ANALIZAR (FORMATO TOON) ===\n".$toonHtml;
        }

        $user = $request->user();

        // Generar la conversación manualmente para obtener el UUID inmediatamente
        $store = resolve(ConversationStore::class);
        $conversationId = $store->storeConversation($user->id, Str::limit($request->validated('prompt'), 50));
        $this->conversationTemplateState->initializeConversationState($conversationId, $html);

        $agent = (new PlantillaAgent($user))->continue($conversationId, $user);

        $response = $agent->stream($prompt, [], $config['provider'], $config['model']);

        return tap($response->toResponse($request), function ($res) use ($conversationId, $config) {
            // El ID de conversación se devuelve en el header para que el frontend pueda seguirla
            $res->headers->set('X-Conversation-Id', $conversationId);
            $res->headers->set('X-AI-Provider', $config['provider']);
            $res->headers->set('X-Accel-Buffering', 'no'); // Crítico para FrankenPHP/Caddy/Nginx sin buffering
        });
    }

    /**
     * Continúa una conversación existente.
     */
    public function reply(string $id, SendChatMessageRequest $request): StreamedResponse
    {
        $conversation = DB::table('agent_conversations')
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $conversation) {
            abort(404, 'Conversación no encontrada.');
        }

        $config = $this->aiConfig->applyConfigToRuntime();
        $prompt = $request->validated('prompt');
        $user = $request->user();
        $this->conversationTemplateState->syncPendingPatches($id);

        $agent = (new PlantillaAgent($user))->continue($id, $user);

        $response = $agent->stream($prompt, [], $config['provider'], $config['model']);

        return tap($response->toResponse($request), function ($res) use ($id, $config) {
            $res->headers->set('X-Conversation-Id', $id);
            $res->headers->set('X-AI-Provider', $config['provider']);
            $res->headers->set('X-Accel-Buffering', 'no'); // Crítico para FrankenPHP/Caddy/Nginx sin buffering
        });
    }

    /**
     * Elimina una conversación.
     */
    public function destroy(string $id, Request $request)
    {
        $deleted = DB::table('agent_conversations')
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->delete();

        if (! $deleted) {
            abort(404);
        }

        return response()->json(['message' => 'Conversación eliminada.']);
    }
}
