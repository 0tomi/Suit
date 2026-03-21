import { describe, expect, it, vi } from 'vitest';
import {
  installLegacyJsxRuntimeWarningFilter,
  isLegacyJsxRuntimeWarning,
} from '../../src/utils/suppressLegacyJsxRuntimeWarning.js';

describe('suppressLegacyJsxRuntimeWarning', () => {
  it('detecta el warning legacy de React por texto', () => {
    expect(isLegacyJsxRuntimeWarning(
      'Your app (or one of its dependencies) is using an outdated JSX transform.',
    )).toBe(true);
    expect(isLegacyJsxRuntimeWarning('otro warning')).toBe(false);
  });

  it('filtra solo el warning legacy y deja pasar el resto', () => {
    const originalWarn = window.console.warn;
    const consoleWarnSpy = vi.fn();
    window.console.warn = consoleWarnSpy;

    try {
      installLegacyJsxRuntimeWarningFilter();

      window.console.warn('Your app (or one of its dependencies) is using an outdated JSX transform.');
      window.console.warn('warning distinto');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning distinto');
    } finally {
      window.console.warn = originalWarn;
      delete window.__suitLegacyJsxWarningFilterInstalled;
    }
  });
});
