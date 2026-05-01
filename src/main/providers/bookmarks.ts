import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isMac, isWindows } from '../platform';
import { getConfig } from '../config';
import { t } from '../i18n';
import type { SearchResult } from '../../shared/types';

const CACHE_TTL_MS = 300_000;
const MIN_QUERY_LENGTH = 2;

interface BookmarkEntry {
  type: 'web';
  name: string;
  url: string;
  description: string;
}

interface BookmarkNode {
  type?: string;
  url?: string;
  name?: string;
  children?: BookmarkNode[];
}

interface BookmarksJson {
  roots?: {
    bookmark_bar?: BookmarkNode;
    other?: BookmarkNode;
    synced?: BookmarkNode;
  };
}

let cache: BookmarkEntry[] | null = null;
let cacheTime = 0;

function bookmarkPaths(): string[] {
  if (isMac) {
    return [
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Google',
        'Chrome',
        'Default',
        'Bookmarks'
      ),
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'BraveSoftware',
        'Brave-Browser',
        'Default',
        'Bookmarks'
      ),
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Chromium',
        'Default',
        'Bookmarks'
      ),
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Microsoft Edge',
        'Default',
        'Bookmarks'
      ),
    ];
  }
  if (isWindows) {
    const local = process.env.LOCALAPPDATA || '';
    return [
      path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks'),
      path.join(
        local,
        'BraveSoftware',
        'Brave-Browser',
        'User Data',
        'Default',
        'Bookmarks'
      ),
      path.join(local, 'Chromium', 'User Data', 'Default', 'Bookmarks'),
      path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks'),
    ];
  }
  return [
    path.join(os.homedir(), '.config', 'google-chrome', 'Default', 'Bookmarks'),
    path.join(
      os.homedir(),
      '.config',
      'BraveSoftware',
      'Brave-Browser',
      'Default',
      'Bookmarks'
    ),
    path.join(os.homedir(), '.config', 'chromium', 'Default', 'Bookmarks'),
    path.join(os.homedir(), '.config', 'microsoft-edge', 'Default', 'Bookmarks'),
  ];
}

function extractAllUrls(node: BookmarkNode, out: BookmarkEntry[]): void {
  if (node.type === 'url' && node.url && node.name) {
    out.push({ type: 'web', name: node.name, url: node.url, description: '' });
  } else if (node.type === 'folder' && node.children) {
    for (const child of node.children) extractAllUrls(child, out);
  }
}

export async function getBookmarks(): Promise<BookmarkEntry[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  const all: BookmarkEntry[] = [];

  await Promise.all(
    bookmarkPaths().map(async (bp) => {
      try {
        if (fs.existsSync(bp)) {
          const data = await fs.promises.readFile(bp, 'utf-8');
          const json = JSON.parse(data) as BookmarksJson;
          if (json.roots) {
            if (json.roots.bookmark_bar) extractAllUrls(json.roots.bookmark_bar, all);
            if (json.roots.other) extractAllUrls(json.roots.other, all);
            if (json.roots.synced) extractAllUrls(json.roots.synced, all);
          }
        }
      } catch {
        // ignore
      }
    })
  );

  cache = all;
  cacheTime = now;
  return all;
}

export async function searchBookmarks(query: string): Promise<SearchResult[]> {
  const config = getConfig();
  if (!config.search.enableBookmarks || query.length < MIN_QUERY_LENGTH) return [];

  const qLower = query.toLowerCase();
  const all = await getBookmarks();
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const b of all) {
    if (
      b.name.toLowerCase().includes(qLower) ||
      b.url.toLowerCase().includes(qLower)
    ) {
      if (seenUrls.has(b.url)) continue;
      seenUrls.add(b.url);
      let description = t('bookmark');
      try {
        const hostname = new URL(b.url).hostname;
        description = `${t('bookmark')} • ${hostname}`;
      } catch {
        // keep default description
      }
      results.push({ type: 'web', name: b.name, url: b.url, description });
    }
  }

  return results;
}
