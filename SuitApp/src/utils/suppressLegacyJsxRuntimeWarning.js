const LEGACY_JSX_RUNTIME_WARNING_PATTERN = /outdated JSX transform/i;

export function isLegacyJsxRuntimeWarning(message) {
  return typeof message === 'string' && LEGACY_JSX_RUNTIME_WARNING_PATTERN.test(message);
}

export function installLegacyJsxRuntimeWarningFilter() {
  if (typeof window === 'undefined' || window.__suitLegacyJsxWarningFilterInstalled) {
    return;
  }

  window.__suitLegacyJsxWarningFilterInstalled = true;

  const originalWarn = window.console.warn.bind(window.console);
  window.console.warn = (...args) => {
    if (isLegacyJsxRuntimeWarning(args[0])) {
      return;
    }

    return originalWarn(...args);
  };
}
