import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useSettingsMock = vi.fn();
const useTutorialMock = vi.fn();
const tutorialDrawerMock = vi.fn();

vi.mock('../../src/context/SettingsContext.jsx', () => ({
    useSettings: () => useSettingsMock(),
}));

vi.mock('../../src/hooks/useTutorial.js', () => ({
    useTutorial: () => useTutorialMock(),
}));

vi.mock('../../src/components/ui/TutorialDrawer.jsx', () => ({
    TutorialDrawer: (props) => {
        tutorialDrawerMock(props);
        return <div data-testid="tutorial-drawer-stub" />;
    },
}));

import { SectionTutorialTrigger } from '../../src/components/ui/SectionTutorialTrigger.jsx';

describe('SectionTutorialTrigger', () => {
    const openTutorial = vi.fn();
    const steps = [{ image: 'step-1.png', description: 'Paso 1' }];

    beforeEach(() => {
        vi.clearAllMocks();
        useSettingsMock.mockReturnValue({ showTutorials: true });
        useTutorialMock.mockReturnValue({
            openTutorial,
            tutorialProps: {
                open: false,
                onClose: vi.fn(),
            },
        });
    });

    it('renderiza el trigger animado y monta el drawer cuando los tutoriales están activos', () => {
        render(
            <SectionTutorialTrigger
                steps={steps}
                ariaLabel="Ver tutorial de prueba"
                testId="section-tutorial-trigger"
            />,
        );

        expect(screen.getByTestId('section-tutorial-trigger')).toHaveClass('tutorial-icon-hop');
        expect(screen.getByTestId('tutorial-drawer-stub')).toBeInTheDocument();
        expect(tutorialDrawerMock).toHaveBeenCalledWith(
            expect.objectContaining({
                steps,
                open: false,
                onClose: expect.any(Function),
            }),
        );
    });

    it('no renderiza nada cuando el toggle global está apagado', () => {
        useSettingsMock.mockReturnValue({ showTutorials: false });

        render(<SectionTutorialTrigger steps={steps} ariaLabel="Ver tutorial oculto" />);

        expect(screen.queryByRole('button', { name: 'Ver tutorial oculto' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('tutorial-drawer-stub')).not.toBeInTheDocument();
    });

    it('abre el tutorial al hacer click sobre el icono', () => {
        render(<SectionTutorialTrigger steps={steps} ariaLabel="Ver tutorial clickable" />);

        fireEvent.click(screen.getByRole('button', { name: 'Ver tutorial clickable' }));

        expect(openTutorial).toHaveBeenCalledTimes(1);
    });
});
