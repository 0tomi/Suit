import React, { useState, useCallback } from 'react';
import { Drawer } from 'vaul';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
    CarouselDots,
} from './Carousel.jsx';
import { Button } from './Button.jsx';

const EMPTY_STEPS = [];

/**
 * Componente reutilizable de Tutorial.
 * Despliega un Drawer desde abajo con un carrusel de imagenes,
 * descripciones por slide y cierre debajo del contenido.
 *
 * Layout del drawer (de arriba a abajo):
 *  - Handle de arrastre (shrink-0)
 *  - Header con titulo "Tutorial" (shrink-0)
 *  - Contenido scrollable: carousel + descripcion + cierre (flex-1, overflow-y-auto)
 *
 * @param {object} props
 * @param {Array<{image: string, description: string}>} props.steps
 *   Array de pasos del tutorial. Cada paso tiene:
 *   - image: URL o import de la imagen (string)
 *   - description: Texto explicativo para ese paso (string)
 * @param {boolean} props.open - Estado controlado del drawer
 * @param {function} props.onClose - Callback para cerrar el drawer
 *
 * @example
 * // En una pagina:
 * import { TutorialDrawer } from '../components/ui/TutorialDrawer.jsx';
 * import { useTutorial } from '../hooks/useTutorial.js';
 * import img1 from '../assets/tutorials/casos/step1.png';
 *
 * const casosSteps = [
 *   { image: img1, description: 'Esta es la lista de casos activos...' },
 * ];
 *
 * function MiPagina() {
 *   const { openTutorial, tutorialProps } = useTutorial();
 *   return (
 *     <>
 *       <button onClick={openTutorial}>Ver tutorial</button>
 *       <TutorialDrawer steps={casosSteps} {...tutorialProps} />
 *     </>
 *   );
 * }
 */
export function TutorialDrawer({ steps = EMPTY_STEPS, open, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Resetea al primer slide cada vez que se abre el drawer
    const handleOpenChange = useCallback((isOpen) => {
        if (!isOpen) {
            onClose?.();
        } else {
            setCurrentIndex(0);
        }
    }, [onClose]);

    const currentStep = steps[currentIndex] ?? {};

    return (
        <Drawer.Root open={open} onOpenChange={handleOpenChange} snapPoints={[0.9]}>
            <Drawer.Portal>
                {/* Overlay con blur, mismo patron que Modal.jsx */}
                <Drawer.Overlay className="fixed inset-0 bg-(--bg-overlay) backdrop-blur-sm z-50" />

                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-(--bg-card) outline-none"
                    style={{ height: '90dvh' }}
                    data-testid="tutorial-drawer-content"
                >
                    {/* Handle de arrastre nativo de vaul */}
                    <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-(--border-default) shrink-0" />

                    {/* Header */}
                    <div className="px-6 pt-4 pb-2 text-center shrink-0">
                        <Drawer.Title className="text-xl font-bold text-(--text-primary)">
                            Tutorial
                        </Drawer.Title>
                    </div>

                    {/* Contenido scrollable: carrusel + descripcion + cierre */}
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-2 pb-6 md:gap-6">

                        {/* Carrusel de imagenes */}
                        <div className="mx-auto w-full max-w-3xl">
                            <Carousel
                                onSlideChange={setCurrentIndex}
                                className="w-full"
                            >
                                <CarouselContent>
                                    {steps.map((step, index) => (
                                        <CarouselItem key={step.image || `step-${index + 1}`}>
                                            <div className="flex h-[clamp(11rem,32vh,22rem)] items-center justify-center px-4">
                                                <img
                                                    src={step.image}
                                                    alt={`Paso ${index + 1} del tutorial`}
                                                    className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                                                    draggable={false}
                                                />
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                <CarouselPrevious />
                                <CarouselNext />
                                <CarouselDots />
                            </Carousel>
                        </div>

                        {/* Descripcion del slide actual */}
                        <p
                            className="mx-auto min-h-[3.5rem] max-w-3xl text-center text-lg leading-8 text-(--text-secondary) md:text-[1.45rem] md:leading-9"
                            data-testid="tutorial-description"
                        >
                            {currentStep.description ?? ''}
                        </p>

                        <Drawer.Close asChild>
                            <Button
                                variant="primary"
                                size="lg"
                                aria-label="Cerrar tutorial"
                                title="Cerrar tutorial"
                                data-testid="tutorial-close-button"
                                data-vaul-no-drag=""
                                className="mx-auto w-full max-w-xs"
                            >
                                Cerrar tutorial
                            </Button>
                        </Drawer.Close>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
