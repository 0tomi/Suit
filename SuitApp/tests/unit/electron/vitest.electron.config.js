import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/unit/electron/**/*.test.js'],
        restoreMocks: true,
        clearMocks: true,
    },
});
