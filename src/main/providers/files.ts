import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isLinux } from '../platform';
import { getConfig } from '../config';
import { t } from '../i18n';
import type { SearchResult } from '../../shared/types';

const MIN_QUERY_LENGTH = 3;

function resolveSearchPaths(): string[] {
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
        const xdgKeys = ['XDG_DESKTOP_DIR', 'XDG_DOCUMENTS_DIR', 'XDG_DOWNLOAD_DIR'];
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

  return paths;
}

export async function searchFiles(query: string): Promise<SearchResult[]> {
  const config = getConfig();
  if (!config.search.enableFiles || query.length < MIN_QUERY_LENGTH) return [];

  const searchPaths = resolveSearchPaths();
  const files: SearchResult[] = [];
  const qLower = query.toLowerCase();

  await Promise.all(
    searchPaths.map(async (searchPath) => {
      try {
        const items = await fs.promises.readdir(searchPath);
        for (const item of items) {
          if (item.toLowerCase().includes(qLower)) {
            files.push({
              type: 'file',
              name: item,
              path: path.join(searchPath, item),
              description: `${t('file')} • ${path.basename(searchPath)} ${t('inFolder')}`,
            });
          }
        }
      } catch {
        // ignore
      }
    })
  );

  return files;
}
