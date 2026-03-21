const fs = require('fs/promises');
const path = require('path');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSuggestedPdfFilename(title) {
  const normalized = String(title || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${normalized || 'documento-sin-titulo'}.pdf`;
}

function buildPdfExportHtml({ title, html, styles = '' }) {
  function normalizePdfFontFamily(fontFamily) {
    if (typeof fontFamily === 'string' && fontFamily.trim()) {
      return fontFamily.trim();
    }

    return '"Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  }

  function buildPdfExportHtml({ title, html, fontFamily }) {
    const resolvedFontFamily = normalizePdfFontFamily(fontFamily);

    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title || 'Documento')}</title>
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        font-family: 'Inter', sans-serif;
        color: #111827;
        font-family: ${resolvedFontFamily};
        font-size: 12pt;
        line-height: 1.55;
      }
      .pdf-wrapper {
        width: 100%;
        min-height: 100%;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      ${styles}

      main {
        width: 100%;
      }

      img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 12px auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        border: 1px solid #d1d5db;
        padding: 8px;
        vertical-align: top;
      }

      a {
        color: #1d4ed8;
        text-decoration: underline;
      }

      hr {
        border: none;
        border-top: 1px solid #d1d5db;
        margin: 16px 0;
      }

      blockquote {
        margin: 16px 0;
        padding-left: 16px;
        border-left: 4px solid #d1d5db;
      }

      [data-page-break="true"] {
        break-before: page;
        page-break-before: always;
        margin: 0;
        border: 0;
        height: 0;
      }

      [data-page-break="true"] > span {
        display: none;
      }
    </style>
  </head>
  <body>
    <main>${html || ''}</main>
  </body>
</html>`;
  }

  async function exportDocumentToPdf({
    browserWindow = null,
    browserWindowFactory = null,
    dialogModule = null,
    fsModule = fs,
    title,
    html,
    styles = '',
    fontFamily,
  } = {}) {
    const electron = require('electron');
    const { BrowserWindow, dialog } = electron;
    const saveDialog = dialogModule || dialog;
    const createWindow = browserWindowFactory || ((options) => new BrowserWindow(options));

    const os = require('os');
    const crypto = require('crypto');

    const saveResult = await saveDialog.showSaveDialog(browserWindow, {
      title: 'Exportar documento a PDF',
      defaultPath: buildSuggestedPdfFilename(title),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    const printWindow = createWindow({
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: false, // Permitir acceso a archivo local temporal
        nodeIntegration: false,
      },
    });

    let tempHtmlPath = null;

    try {
      // Generar archivo temporal para evitar límites de tamaño de data-url y encodeURIComponent
      const tempFileName = `suitapp_export_${crypto.randomBytes(4).toString('hex')}.html`;
      tempHtmlPath = path.join(os.tmpdir(), tempFileName);
      const fullHtml = buildPdfExportHtml({ title, html, styles });

      const fsModule = require('fs');
      fsModule.writeFileSync(tempHtmlPath, fullHtml);

      await printWindow.loadFile(tempHtmlPath);
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(buildPdfExportHtml({ title, html, fontFamily }))}`;
      await printWindow.loadURL(dataUrl);

      const pdfBuffer = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        marginsType: 0, // Usamos los márgenes definidos en el CSS @page
      });

      await fs.writeFile(saveResult.filePath, pdfBuffer);

      return {
        canceled: false,
        filePath: saveResult.filePath,
      };
    } finally {
      if (tempHtmlPath) {
        try {
          const fsSync = require('fs');
          if (fsSync.existsSync(tempHtmlPath)) {
            fsSync.unlinkSync(tempHtmlPath);
          }
        } catch (err) {
          console.error('Error cleaning up temp PDF html:', err);
        }
      }
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.destroy();
      }
    }
  }

  module.exports = {
    buildPdfExportHtml,
    buildSuggestedPdfFilename,
    exportDocumentToPdf,
    normalizePdfFontFamily,
  }
}
