import React, { useState, useRef, useCallback } from 'react';
import { Check, X, ExternalLink, Trash2 } from 'lucide-react';

/**
 * Panel inline para insertar o editar un link en el editor.
 * Se posiciona de forma absoluta bajo el botón que lo activa.
 */
const LinkPopover = ({ isOpen, currentUrl, onConfirm, onRemove, onClose }) => {
    const [url, setUrl] = useState('');
    const inputRef = useRef(null);

    const setInputRef = useCallback((node) => {
        inputRef.current = node;
        if (!node) return;
        setUrl(currentUrl || '');
        node.focus();
    }, [currentUrl]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        const trimmed = url.trim();
        if (!trimmed) return;
        // Agregar protocolo si el usuario olvidó ponerlo
        const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        onConfirm(href);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };

    return (
        <div
            role="dialog"
            aria-label="Editor de enlace"
            className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex items-center gap-2 min-w-[320px]"
            onMouseDown={(e) => e.preventDefault()} // Evita que el editor pierda el foco
        >
            <ExternalLink size={16} className="text-gray-400 shrink-0" />
            <input
                ref={setInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://ejemplo.com"
                className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
            />
            <button
                onClick={handleConfirm}
                disabled={!url.trim()}
                className="p-1 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Confirmar"
            >
                <Check size={16} />
            </button>
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Quitar enlace"
                >
                    <Trash2 size={16} />
                </button>
            )}
            <button
                onClick={onClose}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                title="Cancelar"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default LinkPopover;
