import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { PAGE_GAP_PX } from '../pageLayoutUtils.js';
import { getPagePixelSize, marginToPx, normalizeMargins } from '../marginsUtils.js';

export const autoPaginationPluginKey = new PluginKey('autoPagination');

function areArraysEqual(left = [], right = []) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

/**
 * Crea el decorador visual de separación entre páginas.
 *
 * Ocupa el ancho completo de la hoja (incluyendo márgenes laterales via margen negativo)
 * y contiene tres secciones:
 *  - Blanca superior: espacio visual del margen inferior de la página actual.
 *  - Gris central: el gap físico entre páginas con el número de página.
 *  - Blanca inferior: espacio visual del margen superior de la siguiente página.
 *
 * De este modo el corte de página muestra la hoja como entidad separada.
 *
 * @param {number} position - Posición ProseMirror donde se inserta el widget.
 * @param {number} pageNumber - Número de la página que comienza después del gap.
 * @param {{ topPx, bottomPx, leftPx, rightPx }} marginsPx - Márgenes en píxeles.
 */
function createGapDecoration(position, pageNumber, marginsPx) {
    const topSectionHeight  = marginsPx?.bottomPx ?? 96; // margen inferior de la página saliente
    const botSectionHeight  = marginsPx?.topPx    ?? 96; // margen superior de la página entrante
    const leftPx            = marginsPx?.leftPx   ?? 96;
    const rightPx           = marginsPx?.rightPx  ?? 96;
    const totalHeight       = topSectionHeight + PAGE_GAP_PX + botSectionHeight;

    return Decoration.widget(position, () => {
        const isDark     = document.documentElement.classList.contains('dark');
        const pageColor  = isDark ? '#1f2937' : '#ffffff';
        const gapColor   = isDark ? '#111827' : '#e2e8f0';
        const labelBg    = isDark ? '#374151' : '#cbd5e1';
        const labelColor = isDark ? '#9ca3af' : '#64748b';

        // Contenedor principal: ancho completo incluyendo márgenes laterales
        const gap = document.createElement('div');
        gap.setAttribute('data-auto-page-gap', 'true');
        gap.setAttribute('contenteditable', 'false');
        gap.style.cssText = `
            display: block;
            height: ${totalHeight}px;
            margin-left: -${leftPx}px;
            width: calc(100% + ${leftPx + rightPx}px);
            pointer-events: none;
            user-select: none;
            background: ${pageColor};
        `;

        // Sección blanca superior (margen inferior de la página saliente)
        const topSection = document.createElement('div');
        topSection.style.cssText = `
            height: ${topSectionHeight}px;
            background: ${pageColor};
            box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.12);
        `;

        // Franja gris central con número de página
        const midSection = document.createElement('div');
        midSection.style.cssText = `
            height: ${PAGE_GAP_PX}px;
            background: ${gapColor};
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const label = document.createElement('span');
        label.textContent = `Página ${pageNumber}`;
        label.style.cssText = `
            padding: 0 10px;
            height: 18px;
            line-height: 18px;
            background: ${labelBg};
            color: ${labelColor};
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            border-radius: 999px;
        `;
        midSection.append(label);

        // Sección blanca inferior (margen superior de la página entrante)
        const botSection = document.createElement('div');
        botSection.style.cssText = `
            height: ${botSectionHeight}px;
            background: ${pageColor};
            box-shadow: 0 -4px 8px -2px rgba(0, 0, 0, 0.06);
        `;

        gap.append(topSection, midSection, botSection);
        return gap;
    }, {
        side: -1,
        key: `auto-page-gap-${pageNumber}-${position}`,
    });
}

function buildDecorations(doc, breakPositions = [], marginsPx = null) {
    if (!breakPositions.length) return DecorationSet.empty;

    return DecorationSet.create(
        doc,
        breakPositions.map((position, index) => createGapDecoration(position, index + 2, marginsPx)),
    );
}

function buildPluginState(doc, breakPositions = [], marginsPx = null) {
    return {
        breakPositions,
        marginsPx,
        decorations: buildDecorations(doc, breakPositions, marginsPx),
    };
}

function measureBlockHeight(element) {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const marginTop = Number.parseFloat(styles.marginTop || '0') || 0;
    const marginBottom = Number.parseFloat(styles.marginBottom || '0') || 0;

    return rect.height + marginTop + marginBottom;
}

function collectAutomaticBreaks(view, pageHeightPx) {
    const root = view.dom;
    if (!(root instanceof HTMLElement)) return [];

    const children = Array.from(root.children).filter((child) => (
        child instanceof HTMLElement && child.dataset.autoPageGap !== 'true'
    ));

    const breakPositions = [];
    let currentPageHeight = 0;

    for (const child of children) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.dataset.pageBreak === 'true') {
            currentPageHeight = 0;
            continue;
        }

        const blockHeight = measureBlockHeight(child);
        if (blockHeight <= 0) continue;

        const position = view.posAtDOM(child, 0);
        if (!Number.isFinite(position) || position <= 0) continue;

        if (currentPageHeight > 0 && currentPageHeight + blockHeight > pageHeightPx) {
            breakPositions.push(position);
            currentPageHeight = blockHeight;
            continue;
        }

        currentPageHeight += blockHeight;
    }

    return breakPositions;
}

const AutoPagination = Extension.create({
    name: 'autoPagination',

    addOptions() {
        return {
            getPageLayout: () => null,
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: autoPaginationPluginKey,
                state: {
                    init: (_, state) => buildPluginState(state.doc),
                    apply(transaction, pluginState, _oldState, newState) {
                        const meta = transaction.getMeta(autoPaginationPluginKey);

                        if (meta?.type === 'setBreakPositions') {
                            return buildPluginState(newState.doc, meta.breakPositions, meta.marginsPx);
                        }

                        if (transaction.docChanged) {
                            const mappedPositions = (pluginState?.breakPositions || [])
                                .map((position) => transaction.mapping.map(position))
                                .filter((position, index, list) => position > 0 && list.indexOf(position) === index);

                            // Preserva los marginsPx del estado anterior para que los decoradores
                            // ya renderizados mantengan sus dimensiones hasta el próximo sync.
                            return buildPluginState(newState.doc, mappedPositions, pluginState?.marginsPx);
                        }

                        return pluginState;
                    },
                },
                props: {
                    decorations(state) {
                        return autoPaginationPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
                    },
                },
                view: (view) => {
                    let frameId        = null;
                    let resizeObserver = null;
                    // Evita re-sync inmediato provocado por el propio dispatch de meta.
                    // Sin este flag, cada dispatch de page-break dispara update() → scheduleSync()
                    // → un ciclo de medición extra aunque nada haya cambiado.
                    let skipNextUpdate = false;

                    const runSync = () => {
                        if (frameId != null) window.cancelAnimationFrame(frameId);

                        frameId = window.requestAnimationFrame(() => {
                            frameId = null;

                            const layoutMargins = this.options.getPageLayout?.();
                            const { heightPx } = getPagePixelSize(layoutMargins);

                            // Descuenta márgenes superior e inferior de la página completa para
                            // obtener la altura ÚTIL de contenido por página. Sin este cálculo el
                            // texto invade el margen inferior antes de que se inserte el corte.
                            const m           = normalizeMargins(layoutMargins);
                            const topPx       = marginToPx(m.top,    m.unit);
                            const bottomPx    = marginToPx(m.bottom, m.unit);
                            const leftPx      = marginToPx(m.left,   m.unit);
                            const rightPx     = marginToPx(m.right,  m.unit);
                            const contentHeightPx = Math.max(100, heightPx - topPx - bottomPx);
                            const marginsPx   = { topPx, bottomPx, leftPx, rightPx };

                            const nextBreakPositions    = collectAutomaticBreaks(view, contentHeightPx);
                            const currentBreakPositions = autoPaginationPluginKey.getState(view.state)?.breakPositions || [];

                            if (areArraysEqual(nextBreakPositions, currentBreakPositions)) return;

                            // Marca que el siguiente update() es consecuencia de este dispatch
                            // y no necesita reagendar otra medición.
                            skipNextUpdate = true;
                            view.dispatch(view.state.tr.setMeta(autoPaginationPluginKey, {
                                type: 'setBreakPositions',
                                breakPositions: nextBreakPositions,
                                marginsPx,
                            }));
                        });
                    };

                    /**
                     * Agenda una sincronización via requestAnimationFrame.
                     * El rAF actúa como debounce natural: si llegan varias teclas en el mismo
                     * frame, solo se ejecuta el último (cancelAnimationFrame cancela el anterior).
                     * skipNextUpdate evita el re-sync disparado por el propio dispatch de meta.
                     */
                    const scheduleSync = () => {
                        if (skipNextUpdate) {
                            skipNextUpdate = false;
                            return;
                        }
                        runSync();
                    };

                    // Sincronización inicial para que los page breaks aparezcan al abrir el doc.
                    runSync();

                    if (typeof ResizeObserver !== 'undefined' && view.dom instanceof HTMLElement) {
                        resizeObserver = new ResizeObserver(() => scheduleSync());
                        resizeObserver.observe(view.dom);
                    }

                    return {
                        update() {
                            scheduleSync();
                        },
                        destroy() {
                            if (frameId != null) window.cancelAnimationFrame(frameId);
                            resizeObserver?.disconnect();
                        },
                    };
                },
            }),
        ];
    },
});

export default AutoPagination;
