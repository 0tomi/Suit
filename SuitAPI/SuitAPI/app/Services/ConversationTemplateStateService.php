<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use JsonException;
use RuntimeException;

class ConversationTemplateStateService
{
    public function initializeConversationState(string $conversationId, ?string $html): void
    {
        DB::table('agent_conversations')
            ->where('id', $conversationId)
            ->update([
                'current_html' => $html,
                'last_processed_assistant_message_id' => null,
                'updated_at' => now(),
            ]);
    }

    public function syncPendingPatches(string $conversationId): ?string
    {
        return DB::transaction(function () use ($conversationId): ?string {
            $conversation = DB::table('agent_conversations')
                ->where('id', $conversationId)
                ->lockForUpdate()
                ->first([
                    'id',
                    'current_html',
                    'last_processed_assistant_message_id',
                ]);

            if (! $conversation) {
                throw new RuntimeException('Conversación no encontrada.');
            }

            $assistantMessages = DB::table('agent_conversation_messages')
                ->where('conversation_id', $conversationId)
                ->where('role', 'assistant')
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id', 'content']);

            $messagesToProcess = $this->messagesAfterCursor(
                $assistantMessages,
                $conversation->last_processed_assistant_message_id
            );

            $currentHtml = $conversation->current_html;

            foreach ($messagesToProcess as $assistantMessage) {
                $patches = $this->extractPatches($assistantMessage->content);

                if ($patches === []) {
                    continue;
                }

                if ($currentHtml === null) {
                    throw new RuntimeException('La conversación no tiene un HTML inicial para aplicar parches.');
                }

                $currentHtml = $this->applyPatches($currentHtml, $patches, $assistantMessage->id);
            }

            $latestAssistantMessageId = $assistantMessages->last()?->id;
            $updates = [];

            if ($currentHtml !== $conversation->current_html) {
                $updates['current_html'] = $currentHtml;
            }

            if ($latestAssistantMessageId !== $conversation->last_processed_assistant_message_id) {
                $updates['last_processed_assistant_message_id'] = $latestAssistantMessageId;
            }

            if ($updates !== []) {
                $updates['updated_at'] = now();

                DB::table('agent_conversations')
                    ->where('id', $conversationId)
                    ->update($updates);
            }

            return $currentHtml;
        });
    }

    /**
     * @return Collection<int, object>
     */
    protected function messagesAfterCursor(Collection $assistantMessages, ?string $lastProcessedMessageId): Collection
    {
        if ($lastProcessedMessageId === null) {
            return $assistantMessages;
        }

        $cursorIndex = $assistantMessages->search(
            fn (object $assistantMessage): bool => $assistantMessage->id === $lastProcessedMessageId
        );

        if ($cursorIndex === false) {
            throw new RuntimeException('No se encontró el cursor del último mensaje procesado.');
        }

        return $assistantMessages->slice($cursorIndex + 1)->values();
    }

    /**
     * @return array<int, array{buscar: string, reemplazar_con: string}>
     */
    protected function extractPatches(string $content): array
    {
        preg_match_all('/<template_patches>\s*(.*?)\s*<\/template_patches>/s', $content, $matches);

        if (($matches[1] ?? []) === []) {
            return [];
        }

        $patches = [];

        foreach ($matches[1] as $jsonBlock) {
            try {
                $decodedPatches = json_decode($jsonBlock, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException $exception) {
                throw new RuntimeException('El bloque <template_patches> no contiene JSON válido.', previous: $exception);
            }

            if (! is_array($decodedPatches) || ! array_is_list($decodedPatches)) {
                throw new RuntimeException('El bloque <template_patches> debe contener un arreglo JSON.');
            }

            foreach ($decodedPatches as $patch) {
                $buscar = $patch['buscar'] ?? null;
                $reemplazarCon = $patch['reemplazar_con'] ?? null;

                if (! is_string($buscar) || $buscar === '' || ! is_string($reemplazarCon)) {
                    throw new RuntimeException('Cada parche debe incluir buscar y reemplazar_con como strings válidos.');
                }

                $patches[] = [
                    'buscar' => $buscar,
                    'reemplazar_con' => $reemplazarCon,
                ];
            }
        }

        return $patches;
    }

    /**
     * @param  array<int, array{buscar: string, reemplazar_con: string}>  $patches
     */
    protected function applyPatches(string $currentHtml, array $patches, string $messageId): string
    {
        // Sort patches by length of 'buscar' descending to handle overlapping strings
        // This ensures that longer, more specific strings are replaced before shorter ones
        // that might be substrings of the longer ones.
        usort($patches, function ($a, $b): int {
            return strlen((string) ($b['buscar'] ?? '')) <=> strlen((string) ($a['buscar'] ?? ''));
        });

        foreach ($patches as $patch) {
            if (substr_count($currentHtml, $patch['buscar']) === 0) {
                // If it's not found, it might have been already replaced by a previous patch
                // in the same sequence, or it's an AI hallucination. Skipping instead of
                // crashing the conversation.
                continue;
            }

            $currentHtml = str_replace($patch['buscar'], $patch['reemplazar_con'], $currentHtml);
        }

        return $currentHtml;
    }
}
