import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';

const MentionList = forwardRef((props, ref) => {
    const itemsSignature = useMemo(
        () => props.items.map((item) => `${item.id}:${item.label}`).join('|'),
        [props.items]
    );
    const [selectionState, setSelectionState] = useState({
        index: 0,
        itemsSignature,
    });
    const selectedIndex = selectionState.itemsSignature === itemsSignature ? selectionState.index : 0;

    const updateSelectedIndex = (nextIndex) => {
        setSelectionState({
            index: nextIndex,
            itemsSignature,
        });
    };

    const selectItem = (index) => {
        const item = props.items[index];
        if (item) {
            props.command({ id: item.id, label: item.label });
        }
    };

    const upHandler = () => {
        updateSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        updateSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }
            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }
            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden text-sm w-64 max-h-64 overflow-y-auto z-50">
            {props.items.length ? (
                props.items.map((item, index) => (
                    <button
                        className={`w-full text-left px-3 py-2 cursor-pointer transition-colors ${index === selectedIndex ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        key={item.id}
                        onClick={() => selectItem(index)}
                    >
                        {item.label}
                    </button>
                ))
            ) : (
                <div className="px-3 py-2 text-gray-500">No hay resultados</div>
            )}
        </div>
    );
});

MentionList.displayName = 'MentionList';

export default MentionList;
