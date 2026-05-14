import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux } from '../platform';
import { getConfig } from '../config';
import { t } from '../i18n';
import type { SearchResult } from '../../shared/types';

const MIN_QUERY_LENGTH = 3;

let cachedSearchPaths: string[] | null = null;

function resolveSearchPaths(): string[] {
  if (cachedSearchPaths) return cachedSearchPaths;

  const paths = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Downloads'),
  ];

  if (isLinux) {
    try {
      const xdgConfig = path.join(os.homedir(), '.config', 'user-dirs.dirs');
      if (fs.existsSync(xdgConfig)) {
        const content = fs.readFileSync(xdgConfig, 'utf-8');
        const xdgKeys = [
          'XDG_DESKTOP_DIR',
          'XDG_DOCUMENTS_DIR',
          'XDG_DOWNLOAD_DIR',
        ];
        for (const key of xdgKeys) {
          const match = content.match(new RegExp(`^${key}="(.+)"`, 'm'));
          if (match) {
            const resolved = match[1].replace('$HOME', os.homedir());
            if (!paths.includes(resolved)) paths.push(resolved);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  cachedSearchPaths = paths;
  return paths;
}

export async function searchFiles(query: string): Promise<SearchResult[]> {
  const config = getConfig();
  if (!config.search.enableFiles || query.length < MIN_QUERY_LENGTH) return [];

  const searchPaths = resolveSearchPaths();
  const files: SearchResult[] = [];
  const qLower = query.toLowerCase();

  // Paranoid limits to prevent resource exhaustion.
  const MAX_ITEMS_PER_DIR = 5000;
  const MAX_TOTAL_FILE_RESULTS = 50;

  for (const searchPath of searchPaths) {
    if (files.length >= MAX_TOTAL_FILE_RESULTS) break;

    let dir: fs.Dir | null = null;
    try {
      dir = await fs.promises.opendir(searchPath);
      let count = 0;

      for await (const entry of dir) {
        if (++count > MAX_ITEMS_PER_DIR) break;
        if (entry.name.toLowerCase().includes(qLower)) {
          files.push({
            type: 'file',
            name: entry.name,
            path: path.join(searchPath, entry.name),
            description: `${t('file')} • ${path.basename(searchPath)} ${t('inFolder')}`,
          });
          if (files.length >= MAX_TOTAL_FILE_RESULTS) break;
        }
      }
    } catch {
      // ignore (unreadable dir, permission denied, etc)
    } finally {
      // Ensure directory handle is closed even on break/error.
      try {
        if (dir) await dir.close();
      } catch {
        // ignore
      }
    }
  }

  return files;
}
