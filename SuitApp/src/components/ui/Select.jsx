import {
    Children,
    createContext,
    forwardRef,
    isValidElement,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

const SelectLabelContext = createContext(null);

function extractOptionLabel(children) {
    if (typeof children === 'string' || typeof children === 'number') {
        return String(children).trim();
    }

    if (Array.isArray(children)) {
        const text = children
            .map((child) => extractOptionLabel(child))
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        return text || null;
    }

    return null;
}

function collectLabelsFromChildren(children, labels) {
    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;

        if (child.props?.value != null) {
            const label = extractOptionLabel(child.props.children);
            if (label) labels[String(child.props.value)] = label;
        }

        if (child.props?.children) {
            collectLabelsFromChildren(child.props.children, labels);
        }
    });
}

/**
 * Wrapper de Select basado en Radix que conserva la API compuesta usada
 * por los formularios de la app (`Select`, `SelectTrigger`, etc.).
 */
export function Select({ value, onValueChange, disabled = false, children }) {
    const [labels, setLabels] = useState({});
    const labelsFromChildren = useMemo(() => {
        const nextLabels = {};
        collectLabelsFromChildren(children, nextLabels);
        return nextLabels;
    }, [children]);

    const registerLabel = useCallback((optionValue, label) => {
        setLabels((prev) => {
            const nextKey = String(optionValue);
            if (prev[nextKey] === label) return prev;
            return { ...prev, [nextKey]: label };
        });
    }, []);

    const contextValue = useMemo(() => ({
        currentValue: value,
        labels: { ...labelsFromChildren, ...labels },
        registerLabel,
    }), [value, labelsFromChildren, labels, registerLabel]);

    return (
        <SelectLabelContext.Provider value={contextValue}>
            <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
                {children}
            </SelectPrimitive.Root>
        </SelectLabelContext.Provider>
    );
}

export const SelectTrigger = forwardRef(function SelectTrigger(
    { children, className = '', ...props },
    ref,
) {
    return (
        <SelectPrimitive.Trigger
            ref={ref}
            className={`w-full inline-flex items-center justify-between rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) transition-colors outline-none hover:border-(--border-subtle) focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-(--text-tertiary)" />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
});

/** Muestra el label del item seleccionado o el placeholder cuando no hay valor. */
export const SelectValue = forwardRef(function SelectValue(
    { placeholder, className = '', ...props },
    ref,
) {
    const selectState = useContext(SelectLabelContext);
    const hasValue = selectState?.currentValue != null && selectState.currentValue !== '';
    const visibleLabel = hasValue
        ? (selectState.labels[String(selectState.currentValue)] ?? selectState.currentValue)
        : null;

    return (
        <SelectPrimitive.Value
            ref={ref}
            placeholder={placeholder}
            className={`text-left ${hasValue ? '' : 'text-(--text-tertiary)'} ${className}`}
            {...props}
        >
            {visibleLabel}
        </SelectPrimitive.Value>
    );
});

export const SelectContent = forwardRef(function SelectContent(
    { children, className = '', ...props },
    ref,
) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                ref={ref}
                position="popper"
                sideOffset={6}
                className={`z-[120] max-h-60 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-(--border-default) bg-(--bg-card) shadow-lg ${className}`}
                {...props}
            >
                <SelectPrimitive.Viewport className="p-1">
                    {children}
                </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
});

export const SelectItem = forwardRef(function SelectItem(
    { value, children, className = '', ...props },
    ref,
) {
    const selectState = useContext(SelectLabelContext);
    const normalizedLabel = extractOptionLabel(children);

    return (
        <SelectPrimitive.Item
            ref={ref}
            value={value}
            className={`relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm text-(--text-primary) outline-none transition-colors data-[highlighted]:bg-(--bg-card-hover) data-[highlighted]:text-blue-600 ${className}`}
            {...props}
            onClick={(event) => {
                if (normalizedLabel) {
                    selectState?.registerLabel(value, normalizedLabel);
                }
                props.onClick?.(event);
            }}
        >
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center justify-center text-blue-600">
                <Check className="h-4 w-4" />
            </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    );
});

export const SelectSeparator = forwardRef(function SelectSeparator(
    { className = '', ...props },
    ref,
) {
    return (
        <SelectPrimitive.Separator
            ref={ref}
            className={`-mx-1 my-1 h-px bg-(--border-default) ${className}`}
            {...props}
        />
    );
});
