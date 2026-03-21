export const EDITOR_SHORTCUT_SECTIONS = [
    {
        id: 'edicion',
        title: 'Edicion',
        items: [
            { id: 'undo', keys: 'Ctrl/Cmd + Z', description: 'Deshacer ultimo cambio' },
            { id: 'redo', keys: 'Ctrl/Cmd + Shift + Z', description: 'Rehacer ultimo cambio' },
            { id: 'search', keys: 'Ctrl/Cmd + F', description: 'Buscar en el documento' },
            { id: 'replace', keys: 'Ctrl/Cmd + Shift + H', description: 'Abrir reemplazo', editingOnly: true },
        ],
    },
    {
        id: 'formato',
        title: 'Formato',
        items: [
            { id: 'bold', keys: 'Ctrl/Cmd + B', description: 'Aplicar negrita', editingOnly: true },
            { id: 'italic', keys: 'Ctrl/Cmd + I', description: 'Aplicar cursiva', editingOnly: true },
            { id: 'underline', keys: 'Ctrl/Cmd + U', description: 'Aplicar subrayado', editingOnly: true },
        ],
    },
    {
        id: 'estructura',
        title: 'Estructura',
        items: [
            { id: 'indent', keys: 'Tab', description: 'Aumentar sangria del bloque actual', editingOnly: true },
            { id: 'outdent', keys: 'Shift + Tab', description: 'Reducir sangria del bloque actual', editingOnly: true },
        ],
    },
];

export default EDITOR_SHORTCUT_SECTIONS;
