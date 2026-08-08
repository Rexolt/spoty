import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isWindows } from '../platform';

const SEARCH_DIRS = [
  '/usr/share/pixmaps',
  '/usr/share/icons/hicolor/48x48/apps',
  '/usr/share/icons/hicolor/scalable/apps',
  '/usr/share/icons/hicolor/128x128/apps',
  '/usr/share/icons/hicolor/256x256/apps',
];

/**
 * Absolute icon paths (which `.desktop` files are allowed to use) are only
 * honoured inside these roots. `getIconPath` is reachable from the renderer,
 * so without this an injected `get-icon` call could probe for the existence of
 * any file on disk — and then render it through an `<img src="file://…">`.
 */
const ABSOLUTE_ICON_ROOTS = [
  '/usr/share',
  '/usr/local/share',
  '/var/lib/flatpak',
  '/snap',
  '/opt',
  path.join(os.homedir(), '.local', 'share'),
  path.join(os.homedir(), '.icons'),
];

const EXTENSIONS = ['', '.png', '.svg', '.xpm'];

/** Icon *names* are single path components: no separators, no traversal. */
const ICON_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;

const IMAGE_EXTENSIONS = new Set(['', '.png', '.svg', '.xpm', '.jpg', '.jpeg', '.ico']);

function isInsideAllowedRoot(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  return ABSOLUTE_ICON_ROOTS.some((root) => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
  });
}

export async function getIconPath(iconName: string | undefined): Promise<string | null> {
  if (!iconName || typeof iconName !== 'string' || iconName.length > 512) return null;
  // Icon resolution is Linux-specific; Windows uses native shell integration.
  if (isWindows) return null;

  if (path.isAbsolute(iconName)) {
    if (!isInsideAllowedRoot(iconName)) return null;
    if (!IMAGE_EXTENSIONS.has(path.extname(iconName).toLowerCase())) return null;
    try {
      const resolved = path.resolve(iconName);
      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) return null;
      await fs.promises.access(resolved, fs.constants.R_OK);
      return resolved;
    } catch {
      return null;
    }
  }

  if (!ICON_NAME_PATTERN.test(iconName)) return null;

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
