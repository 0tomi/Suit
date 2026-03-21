const fs = require('fs');
const path = require('path');
const { Menu, Tray, nativeImage } = require('electron');
const { resolveBuildAssetCandidates } = require('./runtimePaths.cjs');

/**
 * Retorna los candidatos válidos para el tray en build empaquetado y en desarrollo.
 * El orden prioriza assets incluidos explícitamente por electron-builder.
 */
function getTrayIconCandidates(baseDir = __dirname) {
  return Array.from(new Set([
    ...resolveBuildAssetCandidates(path.join('build', 'icon.ico')),
    path.join(baseDir, '../dist-renderer/SuitLogoCompacto.png'),
    path.join(baseDir, '../public/SuitLogoCompacto.png'),
    path.join(baseDir, '../src/assets/SuitLogoCompacto.png'),
    path.join(baseDir, '../src/assets/logo_suit_transparent.png'),
    path.join(baseDir, '../src/assets/logo_suit.png'),
    path.join(baseDir, '../src/assets/logo_suit_dark.png'),
  ]));
}

function resolveTrayIconPath({
  baseDir = __dirname,
  existsSyncImpl = fs.existsSync,
  nativeImageImpl = nativeImage,
} = {}) {
  for (const candidate of getTrayIconCandidates(baseDir)) {
    if (!existsSyncImpl(candidate)) continue;
    const image = nativeImageImpl.createFromPath(candidate);
    if (!image.isEmpty()) {
      return candidate;
    }
  }

  return null;
}

function resolveTrayIcon(options = {}) {
  const {
    nativeImageImpl = nativeImage,
    platform = process.platform,
  } = options;
  const resolvedPath = resolveTrayIconPath(options);
  if (!resolvedPath) return null;

  const image = nativeImageImpl.createFromPath(resolvedPath);
  if (image.isEmpty()) return null;

  // En Windows conviene conservar el icono sin resize para no perder las
  // resoluciones del .ico que usa la bandeja al colapsar los iconos ocultos.
  if (platform === 'win32') {
    return image;
  }

  return image.resize({ width: 18, height: 18 });
}

function createTrayManager({
  onShowWindow,
  onQuitApp,
  logger = console,
  baseDir = __dirname,
  TrayImpl = Tray,
  MenuImpl = Menu,
  nativeImageImpl = nativeImage,
  existsSyncImpl = fs.existsSync,
} = {}) {
  let tray = null;
  let isQuitting = false;

  function buildContextMenu() {
    return MenuImpl.buildFromTemplate([
      {
        label: 'Abrir SuitAPP',
        click: () => onShowWindow(),
      },
      {
        type: 'separator',
      },
      {
        label: 'Cerrar',
        click: () => {
          isQuitting = true;
          onQuitApp();
        },
      },
    ]);
  }

  function create() {
    if (tray) return tray;

    const trayIcon = resolveTrayIcon({
      baseDir,
      nativeImageImpl,
      existsSyncImpl,
      platform: process.platform,
    });
    if (!trayIcon) {
      logger.warn?.('Tray icon not found, app will continue without tray support', {
        candidates: getTrayIconCandidates(baseDir),
      });
      return null;
    }

    try {
      tray = new TrayImpl(trayIcon);
      tray.setToolTip('SuitAPP');
      tray.setContextMenu(buildContextMenu());
      tray.on('click', () => onShowWindow());
      tray.on('double-click', () => onShowWindow());
    } catch (error) {
      logger.error?.('Failed to create tray', error);
      tray = null;
      return null;
    }

    return tray;
  }

  function destroy() {
    if (!tray) return;
    tray.destroy();
    tray = null;
  }

  function setQuitting(value) {
    isQuitting = Boolean(value);
  }

  function getIsQuitting() {
    return isQuitting;
  }

  function isCreated() {
    return Boolean(tray);
  }

  return {
    create,
    destroy,
    setQuitting,
    getIsQuitting,
    isCreated,
  };
}

module.exports = {
  createTrayManager,
  getTrayIconCandidates,
  resolveTrayIconPath,
};
