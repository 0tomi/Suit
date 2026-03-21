import React, { useRef, useState } from 'react';
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Baseline,
    Bold,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Highlighter,
    ImagePlus,
    IndentDecrease,
    IndentIncrease,
    Italic,
    Keyboard,
    Link2,
    List,
    ListOrdered,
    Minus,
    Quote,
    Redo,
    Scissors,
    Search,
    Strikethrough,
    Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon,
    Table as TableIcon,
    Underline as UnderlineIcon,
    Undo,
    UserPlus,
} from 'lucide-react';
import * as Toolbar from '@radix-ui/react-toolbar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import LinkPopover from './LinkPopover';

const toolbarButtonClasses = ({ isActive = false, disabled = false }) => [
    'p-2 rounded-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed',
    isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:shadow-md',
    disabled ? 'opacity-45 hover:bg-transparent dark:hover:bg-transparent hover:text-gray-500 dark:hover:text-gray-400 shadow-none' : '',
].filter(Boolean).join(' ');

const fieldClasses = (disabled = false) => [
    'h-8 rounded-lg border border-transparent bg-transparent px-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
    disabled ? 'cursor-not-allowed opacity-45 hover:bg-transparent' : 'hover:bg-gray-100 dark:hover:bg-gray-700',
].filter(Boolean).join(' ');

const colorLabelClasses = (disabled = false) => [
    'flex items-center gap-1 rounded-lg p-1 transition-colors',
    disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
].filter(Boolean).join(' ');

const sectionClasses = 'flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1';
const compactSectionClasses = 'flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1';
const rowClasses = 'flex flex-wrap items-start justify-center gap-2';

const ToolbarButton = React.forwardRef((props, ref) => {
    const {
        onClick,
        isActive,
        icon,
        title,
        value,
        disabled = false,
        ...rest
    } = props;
    const IconComponent = icon;

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {value ? (
                        <Toolbar.ToggleItem
                            ref={ref}
                            value={value}
                            onClick={onClick}
                            disabled={disabled}
                            className={toolbarButtonClasses({ isActive, disabled })}
                            aria-label={title}
                            {...rest}
                        >
                            <IconComponent size={18} />
                        </Toolbar.ToggleItem>
                    ) : (
                        <Toolbar.Button
                            ref={ref}
                            onClick={onClick}
                            disabled={disabled}
                            className={toolbarButtonClasses({ isActive, disabled })}
                            aria-label={title}
                            {...rest}
                        >
                            <IconComponent size={18} />
                        </Toolbar.Button>
                    )}
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={5}>
                    {title}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

ToolbarButton.displayName = 'ToolbarButton';

const EditorToolbar = ({
    editor,
    onAddVariable,
    onInsertImage,
    onInsertPageBreak,
    onToggleSearch,
    onOpenShortcuts,
    searchActive = false,
    readOnly = false,
}) => {
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
    const linkButtonRef = useRef(null);
    const canMutate = !readOnly;

    if (!editor) {
        return null;
    }

    const handleLinkButtonClick = () => {
        if (!canMutate) return;

        if (editor.isActive('link') && !editor.state.selection.empty) {
            editor.chain().focus().unsetLink().run();
            return;
        }

        setLinkPopoverOpen((prev) => !prev);
    };

    const handleLinkConfirm = (href) => {
        if (!canMutate) return;
        editor.chain().focus().setLink({ href }).run();
        setLinkPopoverOpen(false);
    };

    const handleLinkRemove = () => {
        if (!canMutate) return;
        editor.chain().focus().unsetLink().run();
        setLinkPopoverOpen(false);
    };

    const historySection = (
        <div className={sectionClasses}>
            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                icon={Undo}
                title="Deshacer"
                disabled={!canMutate}
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                icon={Redo}
                title="Rehacer"
                disabled={!canMutate}
            />
        </div>
    );

    const textFormattingSection = (
        <Toolbar.ToggleGroup
            type="multiple"
            className={sectionClasses}
            aria-label="Text formatting"
        >
            <ToolbarButton
                value="bold"
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                icon={Bold}
                title="Negrita"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="italic"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                icon={Italic}
                title="Cursiva"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="strike"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                icon={Strikethrough}
                title="Tachado"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="underline"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                icon={UnderlineIcon}
                title="Subrayado"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="superscript"
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                isActive={editor.isActive('superscript')}
                icon={SuperscriptIcon}
                title="Superíndice"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="subscript"
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                isActive={editor.isActive('subscript')}
                icon={SubscriptIcon}
                title="Subíndice"
                disabled={!canMutate}
            />
        </Toolbar.ToggleGroup>
    );

    const blockSection = (
        <Toolbar.ToggleGroup
            type="multiple"
            className={sectionClasses}
            aria-label="Block formatting"
        >
            <ToolbarButton
                value="heading1"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                icon={Heading1}
                title="Título 1"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="heading2"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                icon={Heading2}
                title="Título 2"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="heading3"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                icon={Heading3}
                title="Título 3"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="heading4"
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                isActive={editor.isActive('heading', { level: 4 })}
                icon={Heading4}
                title="Título 4"
                disabled={!canMutate}
            />
        </Toolbar.ToggleGroup>
    );

    const alignmentSection = (
        <Toolbar.ToggleGroup
            type="single"
            className={sectionClasses}
            aria-label="Text alignment"
        >
            <ToolbarButton
                value="left"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
                icon={AlignLeft}
                title="Alinear a la Izquierda"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="center"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
                icon={AlignCenter}
                title="Centrar"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="right"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
                icon={AlignRight}
                title="Alinear a la Derecha"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="justify"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                isActive={editor.isActive({ textAlign: 'justify' })}
                icon={AlignJustify}
                title="Justificar"
                disabled={!canMutate}
            />
        </Toolbar.ToggleGroup>
    );

    const structureSection = (
        <Toolbar.ToggleGroup
            type="multiple"
            className={sectionClasses}
            aria-label="Lists"
        >
            <ToolbarButton
                value="bulletList"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                icon={List}
                title="Lista"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="orderedList"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                icon={ListOrdered}
                title="Lista Numerada"
                disabled={!canMutate}
            />
            <ToolbarButton
                value="blockquote"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                icon={Quote}
                title="Cita"
                disabled={!canMutate}
            />
        </Toolbar.ToggleGroup>
    );

    const fontSection = (
        <div className={compactSectionClasses}>
            <select
                onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
                value={editor.getAttributes('textStyle').fontFamily || ''}
                className={`${fieldClasses(!canMutate)} w-40 sm:w-44`}
                aria-label="Familia de fuente"
                disabled={!canMutate}
            >
                <option value="" disabled>Fuente</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
            </select>

            <select
                onChange={(event) => {
                    const value = event.target.value;

                    if (value) {
                        editor.chain().focus().setFontSize(value).run();
                        return;
                    }

                    editor.chain().focus().unsetFontSize().run();
                }}
                value={editor.getAttributes('textStyle').fontSize || ''}
                className={`${fieldClasses(!canMutate)} w-[4.5rem] px-1`}
                aria-label="Tamaño de fuente"
                disabled={!canMutate}
            >
                <option value="">Tam.</option>
                <option value="10pt">10</option>
                <option value="11pt">11</option>
                <option value="12pt">12</option>
                <option value="14pt">14</option>
                <option value="16pt">16</option>
                <option value="18pt">18</option>
                <option value="24pt">24</option>
                <option value="36pt">36</option>
            </select>

            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <label className={colorLabelClasses(!canMutate)}>
                            <Baseline size={16} className="text-gray-500 dark:text-gray-400" />
                            <input
                                type="color"
                                onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
                                value={editor.getAttributes('textStyle').color || '#000000'}
                                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                                aria-label="Color de texto"
                                disabled={!canMutate}
                            />
                        </label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5}>
                        Color de texto
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <label className={colorLabelClasses(!canMutate)}>
                            <Highlighter size={16} className="text-gray-500 dark:text-gray-400" />
                            <input
                                type="color"
                                onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()}
                                value={editor.getAttributes('highlight').color || '#ffff00'}
                                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                                aria-label="Color de resaltado"
                                disabled={!canMutate}
                            />
                        </label>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={5}>
                        Color de resaltado
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );

    // Search y shortcuts siguen operativos en readOnly; el resto se apaga para
    // que la UI no prometa acciones que el editor no puede ejecutar.
    const secondaryActionSection = (
        <div className={compactSectionClasses}>
            <ToolbarButton
                onClick={onToggleSearch}
                isActive={searchActive}
                icon={Search}
                title="Buscar y reemplazar"
            />
            <ToolbarButton
                onClick={onOpenShortcuts}
                icon={Keyboard}
                title="Atajos de teclado"
                data-testid="editor-shortcuts-trigger"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().indent().run()}
                icon={IndentIncrease}
                title="Aumentar sangría"
                disabled={!canMutate}
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().outdent().run()}
                icon={IndentDecrease}
                title="Reducir sangría"
                disabled={!canMutate}
            />
            {onInsertImage ? (
                <ToolbarButton
                    onClick={onInsertImage}
                    icon={ImagePlus}
                    title="Insertar imagen"
                    disabled={!canMutate}
                />
            ) : null}
            {onInsertPageBreak ? (
                <ToolbarButton
                    onClick={onInsertPageBreak}
                    icon={Scissors}
                    title="Salto de página"
                    data-testid="editor-page-break-trigger"
                    disabled={!canMutate}
                />
            ) : null}
            <ToolbarButton
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                icon={TableIcon}
                title="Insertar Tabla"
                disabled={!canMutate}
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                icon={Minus}
                title="Línea Horizontal"
                disabled={!canMutate}
            />
            <div ref={linkButtonRef} className="relative">
                <ToolbarButton
                    onClick={handleLinkButtonClick}
                    isActive={editor.isActive('link')}
                    icon={Link2}
                    title={editor.isActive('link') ? 'Quitar enlace' : 'Insertar enlace'}
                    disabled={!canMutate}
                />
                <LinkPopover
                    isOpen={canMutate && linkPopoverOpen}
                    currentUrl={editor.getAttributes('link').href || ''}
                    onConfirm={handleLinkConfirm}
                    onRemove={editor.isActive('link') ? handleLinkRemove : null}
                    onClose={() => setLinkPopoverOpen(false)}
                />
            </div>
        </div>
    );

    return (
        <Toolbar.Root
            className="flex w-full flex-col gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm"
            aria-label="Editor formatting"
            data-testid="editor-toolbar"
        >
            <div className={rowClasses} data-testid="editor-toolbar-row-primary">
                {historySection}
                {textFormattingSection}
                {blockSection}
                {alignmentSection}
                {structureSection}
            </div>

            <div className={rowClasses} data-testid="editor-toolbar-row-secondary">
                {fontSection}
                {secondaryActionSection}

                {onAddVariable ? (
                    <div className="flex shrink-0 justify-start">
                        <Toolbar.Button asChild>
                            <button
                                onClick={onAddVariable}
                                disabled={!canMutate}
                                className={[
                                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500',
                                    canMutate ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50' : 'cursor-not-allowed bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 dark:text-indigo-600 opacity-45',
                                ].join(' ')}
                            >
                                <UserPlus size={16} />
                                <span>Variable</span>
                            </button>
                        </Toolbar.Button>
                    </div>
                ) : null}
            </div>
        </Toolbar.Root>
    );
};

export default EditorToolbar;
