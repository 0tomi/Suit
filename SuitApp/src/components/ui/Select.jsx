import { forwardRef } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

/**
 * Wrapper fino sobre Radix Select.
 * Evitamos estado derivado para labels porque Radix ya renderiza el ItemText
 * seleccionado y React 19 es sensible a callback refs inestables.
 */
export function Select({ value, onValueChange, disabled = false, children }) {
    return (
        <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
            {children}
        </SelectPrimitive.Root>
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

export const SelectValue = forwardRef(function SelectValue(
    { className = '', ...props },
    ref,
) {
    return (
        <SelectPrimitive.Value
            ref={ref}
            className={`text-left ${className}`}
            {...props}
        />
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
                <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-(--text-tertiary)">
                    <ChevronUp className="h-4 w-4" />
                </SelectPrimitive.ScrollUpButton>
                <SelectPrimitive.Viewport className="p-1">
                    {children}
                </SelectPrimitive.Viewport>
                <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-(--text-tertiary)">
                    <ChevronDown className="h-4 w-4" />
                </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
});

export const SelectGroup = forwardRef(function SelectGroup(
    { children, ...props },
    ref,
) {
    return (
        <SelectPrimitive.Group ref={ref} {...props}>
            {children}
        </SelectPrimitive.Group>
    );
});

export const SelectLabel = forwardRef(function SelectLabel(
    { className = '', ...props },
    ref,
) {
    return (
        <SelectPrimitive.Label
            ref={ref}
            className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--text-tertiary) ${className}`}
            {...props}
        />
    );
});

export const SelectItem = forwardRef(function SelectItem(
    { value, children, className = '', ...props },
    ref,
) {
    return (
        <SelectPrimitive.Item
            ref={ref}
            value={value}
            className={`relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm text-(--text-primary) outline-none transition-colors data-[highlighted]:bg-(--bg-card-hover) data-[highlighted]:text-blue-600 ${className}`}
            {...props}
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
