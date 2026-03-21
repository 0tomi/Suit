import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

describe('package.json build config', () => {
    it('incluye los assets de build y el renderer empaquetado', () => {
        expect(packageJson.build.files).toEqual(
            expect.arrayContaining([
                'electron/**/*',
                'dist-renderer/**/*',
                'build/**/*',
                'package.json',
            ]),
        );
    });

    it('usa el icono de Windows desde build/icon.ico', () => {
        expect(packageJson.build.win.icon).toBe('build/icon.ico');
    });

    it('expone un script para diagnosticar dependencias de packaging', () => {
        expect(packageJson.scripts['diagnose:packaging']).toContain('npm list');
        expect(packageJson.scripts['diagnose:packaging']).toContain('--omit dev');
    });
});

