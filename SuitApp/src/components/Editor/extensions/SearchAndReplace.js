import { Extension } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import {
    collectSearchMatches,
    normalizeActiveMatchIndex,
} from './searchAndReplaceUtils.js';

export const searchAndReplacePluginKey = new PluginKey('searchAndReplace');

function buildDecorations(doc, matches, activeIndex) {
    if (!matches.length) return DecorationSet.empty;

    return DecorationSet.create(
        doc,
        matches.map((match, index) => Decoration.inline(match.from, match.to, {
            class: index === activeIndex ? 'search-match search-match--active' : 'search-match',
        })),
    );
}

function buildPluginState(doc, state) {
    const matches = collectSearchMatches(doc, state.searchTerm);
    const activeIndex = normalizeActiveMatchIndex(matches.length, state.activeIndex);

    return {
        searchTerm: state.searchTerm || '',
        replaceTerm: state.replaceTerm || '',
        matches,
        activeIndex,
        decorations: buildDecorations(doc, matches, activeIndex),
    };
}

function getActiveSelection(doc, matches, activeIndex) {
    const activeMatch = matches[activeIndex];
    if (!activeMatch) return null;
    return TextSelection.create(doc, activeMatch.from, activeMatch.to);
}

function buildSearchTransaction(state, meta) {
    let transaction = state.tr.setMeta(searchAndReplacePluginKey, meta);
    const nextMatches = collectSearchMatches(state.doc, meta.searchTerm ?? searchAndReplacePluginKey.getState(state)?.searchTerm);
    const nextIndex = normalizeActiveMatchIndex(nextMatches.length, meta.activeIndex);
    const selection = getActiveSelection(state.doc, nextMatches, nextIndex);

    if (selection) {
        transaction = transaction.setSelection(selection).scrollIntoView();
    }

    return transaction;
}

const SearchAndReplace = Extension.create({
    name: 'searchAndReplace',

    addCommands() {
        return {
            setSearchTerm: (searchTerm) => ({ state, dispatch }) => {
                if (!dispatch) return true;
                dispatch(buildSearchTransaction(state, {
                    type: 'setSearchTerm',
                    searchTerm,
                    activeIndex: 0,
                }));
                return true;
            },

            setReplaceTerm: (replaceTerm) => ({ state, dispatch }) => {
                if (!dispatch) return true;
                dispatch(state.tr.setMeta(searchAndReplacePluginKey, {
                    type: 'setReplaceTerm',
                    replaceTerm,
                }));
                return true;
            },

            focusCurrentSearchMatch: () => ({ state, dispatch }) => {
                const pluginState = searchAndReplacePluginKey.getState(state);
                if (!pluginState?.matches?.length || pluginState.activeIndex < 0) return false;
                if (!dispatch) return true;

                const selection = getActiveSelection(state.doc, pluginState.matches, pluginState.activeIndex);
                if (!selection) return false;

                dispatch(state.tr.setSelection(selection).scrollIntoView());
                return true;
            },

            findNext: () => ({ state, dispatch }) => {
                const pluginState = searchAndReplacePluginKey.getState(state);
                if (!pluginState?.matches?.length) return false;
                if (!dispatch) return true;

                const nextIndex = (pluginState.activeIndex + 1) % pluginState.matches.length;
                dispatch(buildSearchTransaction(state, {
                    type: 'setActiveIndex',
                    activeIndex: nextIndex,
                }));
                return true;
            },

            findPrev: () => ({ state, dispatch }) => {
                const pluginState = searchAndReplacePluginKey.getState(state);
                if (!pluginState?.matches?.length) return false;
                if (!dispatch) return true;

                const nextIndex = (pluginState.activeIndex + pluginState.matches.length - 1) % pluginState.matches.length;
                dispatch(buildSearchTransaction(state, {
                    type: 'setActiveIndex',
                    activeIndex: nextIndex,
                }));
                return true;
            },

            replaceCurrent: (replacement = null) => ({ state, dispatch, editor }) => {
                const pluginState = searchAndReplacePluginKey.getState(state);
                if (!pluginState?.matches?.length || editor.isEditable !== true) return false;
                if (!dispatch) return true;

                const activeMatch = pluginState.matches[pluginState.activeIndex];
                if (!activeMatch) return false;

                const nextReplacement = replacement ?? pluginState.replaceTerm ?? '';
                const nextIndex = Math.min(pluginState.activeIndex, Math.max(pluginState.matches.length - 2, 0));

                const transaction = state.tr
                    .insertText(nextReplacement, activeMatch.from, activeMatch.to)
                    .setMeta(searchAndReplacePluginKey, {
                        type: 'afterReplace',
                        activeIndex: nextIndex,
                        replaceTerm: nextReplacement,
                    })
                    .scrollIntoView();

                dispatch(transaction);
                return true;
            },

            replaceAll: (replacement = null) => ({ state, dispatch, editor }) => {
                const pluginState = searchAndReplacePluginKey.getState(state);
                if (!pluginState?.matches?.length || editor.isEditable !== true) return false;
                if (!dispatch) return true;

                const nextReplacement = replacement ?? pluginState.replaceTerm ?? '';
                let transaction = state.tr;

                // Reemplazar de atrás hacia adelante evita recalcular offsets manualmente.
                for (let index = pluginState.matches.length - 1; index >= 0; index -= 1) {
                    const match = pluginState.matches[index];
                    transaction = transaction.insertText(nextReplacement, match.from, match.to);
                }

                transaction = transaction
                    .setMeta(searchAndReplacePluginKey, {
                        type: 'afterReplaceAll',
                        activeIndex: 0,
                        replaceTerm: nextReplacement,
                    })
                    .scrollIntoView();

                dispatch(transaction);
                return true;
            },

            clearSearch: () => ({ state, dispatch }) => {
                if (!dispatch) return true;
                dispatch(state.tr.setMeta(searchAndReplacePluginKey, {
                    type: 'clearSearch',
                }));
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: searchAndReplacePluginKey,
                state: {
                    init: (_, state) => buildPluginState(state.doc, {
                        searchTerm: '',
                        replaceTerm: '',
                        activeIndex: -1,
                    }),
                    apply(transaction, pluginState, _oldState, newState) {
                        const meta = transaction.getMeta(searchAndReplacePluginKey);

                        if (!meta && !transaction.docChanged) {
                            return pluginState;
                        }

                        if (meta?.type === 'clearSearch') {
                            return buildPluginState(newState.doc, {
                                searchTerm: '',
                                replaceTerm: '',
                                activeIndex: -1,
                            });
                        }

                        return buildPluginState(newState.doc, {
                            searchTerm: meta?.searchTerm ?? pluginState.searchTerm,
                            replaceTerm: meta?.replaceTerm ?? pluginState.replaceTerm,
                            activeIndex: meta?.activeIndex ?? pluginState.activeIndex,
                        });
                    },
                },
                props: {
                    decorations(state) {
                        return searchAndReplacePluginKey.getState(state)?.decorations ?? DecorationSet.empty;
                    },
                },
            }),
        ];
    },
});

export function getSearchAndReplaceState(state) {
    return searchAndReplacePluginKey.getState(state) || {
        searchTerm: '',
        replaceTerm: '',
        matches: [],
        activeIndex: -1,
        decorations: DecorationSet.empty,
    };
}

export default SearchAndReplace;
