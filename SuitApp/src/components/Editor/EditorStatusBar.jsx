import React from 'react';

const EditorStatusBar = ({ editor, pageWidthPx = 794 }) => {
    const words = editor.storage.characterCount?.words() ?? 0;
    const characters = editor.storage.characterCount?.characters() ?? 0;

    return (
        <div className="w-full mt-2 px-2 flex items-center justify-end gap-4 text-xs text-gray-400 dark:text-gray-500 select-none" style={{ maxWidth: `${pageWidthPx}px` }}>
            <span>{words} {words === 1 ? 'palabra' : 'palabras'}</span>
            <span className="w-px h-3 bg-gray-200 dark:bg-gray-600" />
            <span>{characters} {characters === 1 ? 'carácter' : 'caracteres'}</span>
        </div>
    );
};

export default EditorStatusBar;
