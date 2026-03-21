import { Info } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useTutorial } from '../../hooks/useTutorial.js';
import { TutorialDrawer } from './TutorialDrawer.jsx';

const EMPTY_STEPS = [];

/**
 * Renderiza el acceso reutilizable al tutorial de una sección.
 * Centraliza el toggle global, la animación de entrada y el drawer.
 */
export function SectionTutorialTrigger({
    steps = EMPTY_STEPS,
    ariaLabel = 'Ver tutorial de la sección',
    title = 'Ver tutorial',
    testId,
    iconSize = 20,
    className = '',
}) {
    const { showTutorials } = useSettings();
    const { openTutorial, tutorialProps } = useTutorial();

    if (!showTutorials || steps.length === 0) {
        return null;
    }

    const buttonClassName = `tutorial-icon-hop text-(--text-tertiary) hover:text-blue-500 transition-colors ${className}`.trim();

    return (
        <>
            <button
                type="button"
                onClick={openTutorial}
                aria-label={ariaLabel}
                title={title}
                data-testid={testId}
                className={buttonClassName}
            >
                <Info size={iconSize} />
            </button>

            <TutorialDrawer steps={steps} {...tutorialProps} />
        </>
    );
}
