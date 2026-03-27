import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const emptyClientRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function ensureGeometryApi(target) {
  if (!target || typeof target.getClientRects === 'function') return;

  Object.defineProperty(target, 'getClientRects', {
    configurable: true,
    value: () => [emptyClientRect],
  });
}

function ensurePointerCaptureApi(target) {
  if (!target) return;

  if (typeof target.hasPointerCapture !== 'function') {
    Object.defineProperty(target, 'hasPointerCapture', {
      configurable: true,
      value: () => false,
    });
  }

  if (typeof target.setPointerCapture !== 'function') {
    Object.defineProperty(target, 'setPointerCapture', {
      configurable: true,
      value: () => {},
    });
  }

  if (typeof target.releasePointerCapture !== 'function') {
    Object.defineProperty(target, 'releasePointerCapture', {
      configurable: true,
      value: () => {},
    });
  }
}

function ensureScrollIntoViewApi(target) {
  if (!target) return;

  if (typeof target.scrollIntoView !== 'function') {
    Object.defineProperty(target, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    });
  }
}

ensureGeometryApi(globalThis.Element?.prototype);
ensureGeometryApi(globalThis.Text?.prototype);
ensureGeometryApi(globalThis.Range?.prototype);
ensurePointerCaptureApi(globalThis.Element?.prototype);
ensureScrollIntoViewApi(globalThis.Element?.prototype);

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.electronAPI = {
    dialog: {
      openImage: vi.fn().mockResolvedValue({ canceled: true }),
    },
    documents: {
      exportPdf: vi.fn().mockResolvedValue({ canceled: true }),
      getVersionHistory: vi.fn().mockResolvedValue([]),
      getVersionContent: vi.fn().mockResolvedValue(null),
    },
    logs: {
      debug: vi.fn().mockResolvedValue(true),
      info: vi.fn().mockResolvedValue(true),
      warn: vi.fn().mockResolvedValue(true),
      error: vi.fn().mockResolvedValue(true),
    },
  };
});
