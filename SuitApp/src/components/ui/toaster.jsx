import { Toaster as SileoToaster } from 'sileo';

export function Toaster() {
    return (
        <SileoToaster
            position="top-center"
            offset={24}
            options={{
                duration: 3000,
                fill: '#0f172a',
                styles: {
                    description: 'sileo-toast-description',
                },
            }}
        />
    );
}
