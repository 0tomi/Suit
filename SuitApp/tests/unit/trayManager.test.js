import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
    createTrayManager,
    getTrayIconCandidates,
    resolveTrayIconPath,
} = require('../../electron/trayManager.cjs');

function normalizePath(value) {
    return String(value).replace(/\\/g, '/');
}

function buildFakeImage(path, isEmpty = false) {
    return {
        _path: path,
        isEmpty: () => isEmpty,
        resize: ({ width, height }) => ({
            _path: path,
            width,
            height,
            isEmpty: () => false,
        }),
    };
}

function createFakeMenu() {
    return {
        buildFromTemplate: vi.fn((template) => template),
    };
}

function createFakeTrayCtor() {
    return vi.fn(function Tray(image) {
        this.image = image;
        this.setToolTip = vi.fn();
        this.setContextMenu = vi.fn();
        this.on = vi.fn();
        this.destroy = vi.fn();
    });
}

describe('trayManager.cjs', () => {
    it('prioriza assets empaquetados en los candidatos del tray', () => {
        const candidates = getTrayIconCandidates('/tmp/suitapp/electron');

        expect(normalizePath(candidates[0])).toContain('build/icon.ico');
        expect(candidates).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/dist-renderer[\\/]SuitLogoCompacto\.png$/),
                expect.stringMatching(/public[\\/]SuitLogoCompacto\.png$/),
            ]),
        );
    });

    it('continúa sin tray cuando no encuentra un icono válido', () => {
        const logger = { warn: vi.fn(), error: vi.fn() };
        const trayCtor = createFakeTrayCtor();
        const manager = createTrayManager({
            onShowWindow: vi.fn(),
            onQuitApp: vi.fn(),
            logger,
            TrayImpl: trayCtor,
            MenuImpl: createFakeMenu(),
            existsSyncImpl: vi.fn(() => false),
            nativeImageImpl: {
                createFromPath: vi.fn((targetPath) => buildFakeImage(targetPath, true)),
            },
        });

        expect(manager.create()).toBeNull();
        expect(manager.isCreated()).toBe(false);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(trayCtor).not.toHaveBeenCalled();
    });

    it('crea el tray cuando encuentra un asset empaquetado válido', () => {
        const trayCtor = createFakeTrayCtor();
        const existsSyncImpl = vi.fn((targetPath) => normalizePath(targetPath).endsWith('build/icon.ico'));
        const nativeImageImpl = {
            createFromPath: vi.fn((targetPath) => buildFakeImage(targetPath, !normalizePath(targetPath).endsWith('build/icon.ico'))),
        };

        const resolvedPath = resolveTrayIconPath({
            baseDir: '/tmp/suitapp/electron',
            existsSyncImpl,
            nativeImageImpl,
        });

        const manager = createTrayManager({
            onShowWindow: vi.fn(),
            onQuitApp: vi.fn(),
            logger: { warn: vi.fn(), error: vi.fn() },
            baseDir: '/tmp/suitapp/electron',
            TrayImpl: trayCtor,
            MenuImpl: createFakeMenu(),
            existsSyncImpl,
            nativeImageImpl,
        });

        expect(normalizePath(resolvedPath)).toContain('build/icon.ico');
        const tray = manager.create();

        expect(tray).toBeTruthy();
        expect(manager.isCreated()).toBe(true);
        expect(trayCtor).toHaveBeenCalledTimes(1);
    });

    it('en Windows entrega el .ico sin redimensionar para evitar iconos invisibles en el tray', () => {
        const trayCtor = createFakeTrayCtor();
        const manager = createTrayManager({
            onShowWindow: vi.fn(),
            onQuitApp: vi.fn(),
            logger: { warn: vi.fn(), error: vi.fn() },
            baseDir: '/tmp/suitapp/electron',
            TrayImpl: trayCtor,
            MenuImpl: createFakeMenu(),
            existsSyncImpl: vi.fn((targetPath) => normalizePath(targetPath).endsWith('build/icon.ico')),
            nativeImageImpl: {
                createFromPath: vi.fn((targetPath) => buildFakeImage(targetPath, false)),
            },
            platform: 'win32',
        });

        const tray = manager.create();

        expect(tray).toBeTruthy();
        expect(normalizePath(tray.image)).toContain('build/icon.ico');
    });
});

