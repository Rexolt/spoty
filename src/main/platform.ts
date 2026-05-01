import * as path from 'path';

export const isWindows = process.platform === 'win32';
export const isLinux = process.platform === 'linux';
export const isMac = process.platform === 'darwin';

/**
 * Resolves the absolute path to the icon file used for the BrowserWindow.
 * `__dirname` at runtime is `<root>/dist/main`, so we walk up two levels.
 */
export const iconPath = path.join(
  __dirname,
  '..',
  '..',
  'build',
  'icons',
  isWindows ? 'icon.ico' : '512x512.png'
);
