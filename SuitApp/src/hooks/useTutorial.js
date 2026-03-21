import { useState, useCallback } from 'react';

/**
 * Hook de conveniencia para manejar el estado open/close de un TutorialDrawer.
 * Sigue el mismo patron que useConfirmDialog.js.
 *
 * @returns {{ openTutorial: function, closeTutorial: function, tutorialProps: object }}
 *
 * @example
 * const { openTutorial, tutorialProps } = useTutorial();
 *
 * return (
 *   <>
 *     <button onClick={openTutorial}>Ver tutorial</button>
 *     <TutorialDrawer steps={misSteps} {...tutorialProps} />
 *   </>
 * );
 */
export const useTutorial = () => {
    const [open, setOpen] = useState(false);

    const openTutorial = useCallback(() => setOpen(true), []);
    const closeTutorial = useCallback(() => setOpen(false), []);

    /** Props listas para hacer spread sobre <TutorialDrawer /> */
    const tutorialProps = { open, onClose: closeTutorial };

    return { openTutorial, closeTutorial, tutorialProps };
};
