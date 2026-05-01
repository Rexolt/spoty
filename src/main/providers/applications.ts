import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Fuse from 'fuse.js';
import { isLinux, isMac, isWindows } from '../platform';
import type { SearchResult } from '../../shared/types';

const CACHE_TTL_MS = 300_000;

let cache: SearchResult[] | null = null;
let cacheTime = 0;

export async function getApplications(): Promise<SearchResult[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  const apps: SearchResult[] = [];

  if (isMac) {
    const appDirs = ['/Applications', path.join(os.homedir(), 'Applications')];
    await Promise.all(
      appDirs.map(async (dir) => {
        try {
          const items = await fs.promises.readdir(dir);
          for (const item of items) {
            if (item.endsWith('.app')) {
              apps.push({
                type: 'app',
                name: item.replace('.app', ''),
                path: path.join(dir, item),
                icon: 'application',
                description: '',
              });
            }
          }
        } catch {
          // ignore
        }
      })
    );
  } else if (isWindows) {
    const startMenuDirs = [
      path.join(
        process.env.PROGRAMDATA || 'C:\\ProgramData',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs'
      ),
      path.join(
        process.env.APPDATA || '',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs'
      ),
    ];

    async function scanDir(dir: string, depth = 0): Promise<void> {
      if (depth > 3) return;
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });
        await Promise.all(
          items.map(async (item) => {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              await scanDir(fullPath, depth + 1);
            } else if (item.name.toLowerCase().endsWith('.lnk')) {
              apps.push({
                type: 'app',
                name: item.name.replace(/\.lnk$/i, ''),
                path: fullPath,
                icon: 'application',
                description: '',
              });
            }
          })
        );
      } catch {
        // ignore
      }
    }

    await Promise.all(startMenuDirs.map((dir) => scanDir(dir)));
  } else if (isLinux) {
    const dirs = [
      '/usr/share/applications',
      path.join(os.homedir(), '.local/share/applications'),
      '/var/lib/flatpak/exports/share/applications',
      path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
      '/snap/bin',
    ];

    await Promise.all(
      dirs.map(async (dir) => {
        try {
          const files = await fs.promises.readdir(dir);
          await Promise.all(
            files.map(async (file) => {
              if (!file.endsWith('.desktop')) return;
              try {
                const content = await fs.promises.readFile(
                  path.join(dir, file),
                  'utf-8'
                );
                if (/^NoDisplay=true$/m.test(content)) return;
                if (/^Hidden=true$/m.test(content)) return;

                const name = content.match(/^Name=(.+)$/m)?.[1];
                const icon = content.match(/^Icon=(.+)$/m)?.[1];
                const comment = content.match(/^Comment=(.+)$/m)?.[1];

                if (name) {
                  apps.push({
                    type: 'app',
                    name,
                    path: path.join(dir, file),
                    icon: icon || 'application',
                    description: comment || '',
                  });
                }
              } catch {
                // ignore
              }
            })
          );
        } catch {
          // ignore
        }
      })
    );
  }

  cache = apps;
  cacheTime = now;
  return apps;
}

export async function searchApplications(query: string): Promise<SearchResult[]> {
  const apps = await getApplications();

  if (query) {
    const fuse = new Fuse(apps, {
      keys: ['name', 'description'],
      threshold: 0.3,
    });
    return fuse.search(query).map((r) => r.item);
  }

  return apps;
}
