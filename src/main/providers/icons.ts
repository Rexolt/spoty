import * as fs from 'fs';
import * as path from 'path';
import { isWindows } from '../platform';

const SEARCH_DIRS = [
  '/usr/share/pixmaps',
  '/usr/share/icons/hicolor/48x48/apps',
  '/usr/share/icons/hicolor/scalable/apps',
  '/usr/share/icons/hicolor/128x128/apps',
  '/usr/share/icons/hicolor/256x256/apps',
];

const EXTENSIONS = ['', '.png', '.svg', '.xpm'];

export async function getIconPath(iconName: string | undefined): Promise<string | null> {
  if (!iconName) return null;
  // Icon resolution is Linux-specific; Windows uses native shell integration.
  if (isWindows) return null;

  if (path.isAbsolute(iconName)) {
    try {
      await fs.promises.access(iconName, fs.constants.R_OK);
      return iconName;
    } catch {
      return null;
    }
  }

  for (const dir of SEARCH_DIRS) {
    for (const ext of EXTENSIONS) {
      const fullPath = path.join(dir, iconName + ext);
      try {
        await fs.promises.access(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch {
        // not found
      }
    }
  }
  return null;
}
