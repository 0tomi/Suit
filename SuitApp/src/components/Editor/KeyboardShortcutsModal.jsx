import React from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { EDITOR_SHORTCUT_SECTIONS } from '../../constants/editorShortcuts.js';

const shortcutKeyClasses = 'inline-flex min-w-[2.5rem] items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700';

function renderShortcutKeys(keys) {
    return keys.split('+').map((part) => part.trim()).filter(Boolean);
}

export default function KeyboardShortcutsModal({ open, onClose }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Atajos de teclado"
            subtitle="Solo se listan combinaciones soportadas hoy por el editor."
            maxWidth="max-w-3xl"
        >
            <div className="space-y-6" data-testid="editor-shortcuts-modal">
                {EDITOR_SHORTCUT_SECTIONS.map((section) => (
                    <section key={section.id} className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Keyboard className="h-4 w-4 text-blue-600" />
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-800">
                                {section.title}
                            </h3>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-gray-200">
                            {section.items.map((shortcut) => (
                                <div
                                    key={shortcut.id}
                                    className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">
                                            {shortcut.description}
                                        </span>
                                        {shortcut.editingOnly ? (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                                Solo edicion
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {renderShortcutKeys(shortcut.keys).map((key) => (
                                            <span key={`${shortcut.id}-${key}`} className={shortcutKeyClasses}>
                                                {key}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Modal>
    );
}
