import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfigPath = path.resolve(process.cwd(), 'vite.config.js');
const viteConfigSource = readFileSync(viteConfigPath, 'utf8');

describe('vite config', () => {
  it('mantiene el plugin que limpia el JSX legacy en dependencias conocidas', () => {
    expect(viteConfigSource).toContain("name: 'strip-legacy-jsx-runtime-dev-props'");
    expect(viteConfigSource).toContain('transformLegacyJsxRuntimeModule');
  });

  it('no excluye react-big-calendar ni uncontrollable del prebundle', () => {
    expect(viteConfigSource).not.toMatch(/exclude:\s*\[[^\]]*react-big-calendar[^\]]*uncontrollable[^\]]*\]/s);
  });

  it('separa la salida del renderer del output de electron-builder', () => {
    expect(viteConfigSource).toContain("outDir: 'dist-renderer'");
  });
});
