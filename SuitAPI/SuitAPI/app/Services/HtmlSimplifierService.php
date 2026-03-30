<?php

namespace App\Services;

use DOMDocument;
use DOMNode;
use DOMText;
use Illuminate\Support\Facades\DB;

class HtmlSimplifierService
{
    /**
     * Transforma un fragmento de HTML o documento completo en formato TOON (Tree-Oriented Object Notation).
     * TOON representa el DOM como una estructura de paréntesis muy compacta para ahorrar tokens.
     * Ejemplo: (p "Hola " (b "Juan"))
     */
    public function toToon(string $html): string
    {
        if (trim($html) === '') {
            return '""';
        }

        $dom = new DOMDocument;
        libxml_use_internal_errors(true);
        // Envolvemos en body para asegurar que si hay múltiples raíces, el documentElement sea 'body'
        // y podamos iterar sobre todos sus hijos sin perder nada.
        $wrappedHtml = '<?xml encoding="UTF-8"><body>'.$html.'</body>';
        $dom->loadHTML($wrappedHtml, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        $root = $dom->documentElement;

        if (! $root) {
            return '""';
        }

        // Si el root es 'body' (como lo forzamos arriba), procesamos sus hijos
        if ($root->nodeName === 'body' || $root->nodeName === 'html') {
            $result = [];
            foreach ($root->childNodes as $child) {
                $toon = $this->nodeToToon($child);
                if ($toon !== null) {
                    $result[] = $toon;
                }
            }

            return count($result) === 0 ? '""' : implode(' ', $result);
        }

        return $this->nodeToToon($root) ?? '""';
    }

    /**
     * Convierte un nodo del DOM a su representación TOON de forma recursiva.
     */
    protected function nodeToToon(DOMNode $node): ?string
    {
        if ($node instanceof DOMText) {
            $text = trim($node->textContent);
            if ($text === '') {
                return null;
            }

            // Escapar comillas dobles en el texto y envolver en comillas
            return '"'.str_replace('"', '\"', $text).'"';
        }

        if ($node->nodeType === XML_ELEMENT_NODE) {
            $tag = strtolower($node->nodeName);
            $children = [];

            foreach ($node->childNodes as $child) {
                $childToon = $this->nodeToToon($child);
                if ($childToon !== null) {
                    $children[] = $childToon;
                }
            }

            if (empty($children)) {
                return "({$tag})";
            }

            return "({$tag} ".implode(' ', $children).')';
        }

        return null;
    }

    /**
     * Método opcional para simplemente limpiar el HTML de todos los atributos.
     * Útil si el usuario prefiere HTML "puro" pero sin peso extra.
     */
    public function cleanHtml(string $html): string
    {
        $dom = new DOMDocument;
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        $this->stripAttributes($dom);

        return $dom->saveHTML($dom->documentElement);
    }

    /**
     * Elimina conversaciones de IA y sus mensajes con más de 30 días de antigüedad.
     * Esto limpia tanto el HTML acumulado como el historial de mensajes para ahorrar espacio.
     */
    public function cleanupOldConversations(int $days = 30): int
    {
        $cutoff = now()->subDays($days);

        return DB::transaction(function () use ($cutoff) {
            $conversationIds = DB::table('agent_conversations')
                ->where('created_at', '<', $cutoff)
                ->pluck('id');

            if ($conversationIds->isEmpty()) {
                return 0;
            }

            // Eliminar mensajes asociados
            DB::table('agent_conversation_messages')
                ->whereIn('conversation_id', $conversationIds)
                ->delete();

            // Eliminar las conversaciones
            return DB::table('agent_conversations')
                ->whereIn('id', $conversationIds)
                ->delete();
        });
    }

    protected function stripAttributes(DOMNode $node): void
    {
        if ($node instanceof \DOMElement) {
            $attributes = [];
            foreach ($node->attributes as $attr) {
                $attributes[] = $attr->nodeName;
            }

            foreach ($attributes as $attrName) {
                // Conservar solo atributos críticos si se desea, por ahora borramos todo
                $node->removeAttribute($attrName);
            }
        }

        foreach ($node->childNodes as $child) {
            $this->stripAttributes($child);
        }
    }
}
