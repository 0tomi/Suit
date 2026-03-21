import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'sileo/styles.css';
import './index.css';
import { installLegacyJsxRuntimeWarningFilter } from './utils/suppressLegacyJsxRuntimeWarning.js';
import { installGlobalErrorLogging } from './services/logService.js';

installLegacyJsxRuntimeWarningFilter();
installGlobalErrorLogging();

const root = createRoot(document.getElementById('root'));

const { default: App } = await import('./App.jsx');

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
