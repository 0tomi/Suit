import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Contexto interno que comparte el estado del carrusel entre compound components.
 */
const CarouselContext = createContext(null);

const useCarousel = () => {
    const ctx = useContext(CarouselContext);
    if (!ctx) throw new Error('useCarousel debe usarse dentro de <Carousel>');
    return ctx;
};

/**
 * Componente raiz del carrusel. Wrapper sobre embla-carousel-react.
 * Usa el patron compound-component para permitir composicion flexible.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.opts] - Opciones de embla-carousel (loop, align, etc.)
 * @param {function} [props.onSlideChange] - Callback(index) cuando cambia el slide activo
 * @param {string} [props.className]
 */
export function Carousel({ children, opts, onSlideChange, className = '' }) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, ...opts });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [scrollSnaps, setScrollSnaps] = useState([]);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);

    // Sincroniza el estado local con embla cuando cambia el slide
    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        const index = emblaApi.selectedScrollSnap();
        setScrollSnaps(emblaApi.scrollSnapList());
        setSelectedIndex(index);
        setCanScrollPrev(emblaApi.canScrollPrev());
        setCanScrollNext(emblaApi.canScrollNext());
        onSlideChange?.(index);
    }, [emblaApi, onSlideChange]);

    useEffect(() => {
        if (!emblaApi) return;
        const frameId = window.requestAnimationFrame(() => {
            onSelect();
        });
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        return () => {
            window.cancelAnimationFrame(frameId);
            emblaApi.off('select', onSelect);
            emblaApi.off('reInit', onSelect);
        };
    }, [emblaApi, onSelect]);

    // Navegacion via teclado (ArrowLeft/ArrowRight) cuando el container tiene foco
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'ArrowLeft') emblaApi?.scrollPrev();
        if (e.key === 'ArrowRight') emblaApi?.scrollNext();
    }, [emblaApi]);

    return (
        <CarouselContext.Provider value={{ emblaRef, emblaApi, selectedIndex, scrollSnaps, canScrollPrev, canScrollNext }}>
            <div
                className={`relative ${className}`}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="region"
                aria-label="Carrusel de tutorial"
            >
                {children}
            </div>
        </CarouselContext.Provider>
    );
}

/**
 * Contenedor del viewport del carrusel. Envuelve los slides con overflow hidden.
 */
export function CarouselContent({ children, className = '' }) {
    const { emblaRef } = useCarousel();
    return (
        <div ref={emblaRef} className="overflow-hidden">
            <div className={`flex ${className}`}>
                {children}
            </div>
        </div>
    );
}

/**
 * Un slide individual del carrusel.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function CarouselItem({ children, className = '' }) {
    return (
        <div className={`min-w-0 shrink-0 grow-0 basis-full ${className}`}>
            {children}
        </div>
    );
}

/**
 * Boton para ir al slide anterior.
 */
export function CarouselPrevious({ className = '' }) {
    const { emblaApi, canScrollPrev } = useCarousel();
    if (!canScrollPrev) return null;
    return (
        <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-(--bg-card) border border-(--border-default) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card-hover) transition-colors shadow-sm ${className}`}
            aria-label="Anterior"
        >
            <ChevronLeft size={20} />
        </button>
    );
}

/**
 * Boton para ir al slide siguiente.
 */
export function CarouselNext({ className = '' }) {
    const { emblaApi, canScrollNext } = useCarousel();
    if (!canScrollNext) return null;
    return (
        <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-(--bg-card) border border-(--border-default) text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card-hover) transition-colors shadow-sm ${className}`}
            aria-label="Siguiente"
        >
            <ChevronRight size={20} />
        </button>
    );
}

/**
 * Indicadores de posicion (dots) del carrusel.
 * Dot activo: azul-600. Inactivos: borde default.
 */
export function CarouselDots({ className = '' }) {
    const { emblaApi, selectedIndex, scrollSnaps } = useCarousel();
    if (scrollSnaps.length <= 1) return null;
    return (
        <div className={`flex justify-center gap-2 mt-4 ${className}`}>
            {scrollSnaps.map((snap, index) => (
                <button
                    key={`snap-${snap}`}
                    type="button"
                    onClick={() => emblaApi?.scrollTo(index)}
                    aria-label={`Ir al paso ${index + 1}`}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        index === selectedIndex
                            ? 'bg-blue-600 scale-125'
                            : 'bg-(--border-default) hover:bg-(--text-tertiary)'
                    }`}
                />
            ))}
        </div>
    );
}
