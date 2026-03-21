import { describe, it, expect } from 'vitest';
import {
  stripLegacyJsxDevProps,
  transformLegacyJsxRuntimeModule,
} from '../../scripts/patch-uncontrollable-jsx-runtime.mjs';

describe('stripLegacyJsxDevProps', () => {
  it('elimina __source y __self del bloque legacy de createElement', () => {
    const input = `return React.createElement(Component, _extends({}, props, {\n  innerRef: ref,\n  __source: {\n    fileName: _jsxFileName,\n    lineNumber: 128\n  },\n  __self: this\n}));`;

    const output = stripLegacyJsxDevProps(input);

    expect(output).not.toContain('__self');
    expect(output).not.toContain('__source');
    expect(output).toContain('innerRef: ref');
  });

  it('no modifica codigo que ya no tiene el bloque legacy', () => {
    const input = 'return React.createElement(Component, _extends({}, props, { innerRef: ref }));';
    expect(stripLegacyJsxDevProps(input)).toBe(input);
  });

  it('tambien limpia el bloque legacy cuando viene embebido en bundles de terceros', () => {
    const input = `return React.createElement(UncontrolledComponent, _extends({}, props, {\n  innerRef: ref,\n  __source: {\n    fileName: _jsxFileName,\n    lineNumber: 128\n  },\n  __self: this\n}));`;

    const output = stripLegacyJsxDevProps(input);

    expect(output).toContain('innerRef: ref');
    expect(output).not.toContain('__source');
    expect(output).not.toContain('__self');
  });

  it('solo transforma modulos legacy conocidos y deja intacto el resto', () => {
    const input = `return React.createElement(Component, _extends({}, props, {\n  innerRef: ref,\n  __source: {\n    fileName: _jsxFileName,\n    lineNumber: 128\n  },\n  __self: this\n}));`;

    expect(
      transformLegacyJsxRuntimeModule(
        '/tmp/project/node_modules/uncontrollable/lib/esm/uncontrollable.js',
        input,
      ),
    ).not.toContain('__self');

    expect(
      transformLegacyJsxRuntimeModule(
        '/tmp/project/src/components/App.jsx',
        input,
      ),
    ).toBeNull();
  });

  it('tambien transforma el bundle precompilado de react-big-calendar dentro de .vite/deps', () => {
    const input = `return React.createElement(Component, _extends({}, props, {\n  innerRef: ref,\n  __source: {\n    fileName: _jsxFileName,\n    lineNumber: 128\n  },\n  __self: this\n}));`;

    expect(
      transformLegacyJsxRuntimeModule(
        '/tmp/project/node_modules/.vite/deps/react-big-calendar-ABC123.js',
        input,
      ),
    ).not.toContain('__self');
  });
});
