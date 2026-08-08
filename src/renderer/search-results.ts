import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict, type DictKey } from './i18n';
import { updateWindowSize } from './window-size';
import type { SearchResult } from '../shared/types';

const TYPE_LABEL_KEYS: Record<SearchResult['type'], DictKey> = {
  app: 'type_app',
  command: 'type_command',
  syscommand: 'type_syscommand',
  alias: 'type_alias',
  weather: 'type_weather',
  web: 'type_web',
  calc: 'type_calc',
  clipboard: 'type_clipboard',
  file: 'type_file',
};

async function loadIcon(iconName: string | undefined): Promise<string | null> {
  if (!iconName) return null;
  try {
    return await api.invoke('get-icon', iconName);
  } catch {
    return null;
  }
}

function buildIcon(item: SearchResult): HTMLDivElement {
  const icon = document.createElement('div');
  icon.className = 'result-icon';

  switch (item.type) {
    case 'weather':
      icon.textContent = '⛅';
      return icon;
    case 'calc':
      icon.textContent = '🧮';
      return icon;
    case 'command':
      icon.textContent = '⚡';
      return icon;
    case 'syscommand':
      icon.textContent = '⚙️';
      return icon;
    case 'web':
      icon.textContent = '🌐';
      return icon;
    case 'clipboard':
      icon.textContent = '📋';
      return icon;
    case 'file':
      icon.textContent = '📄';
      return icon;
  }

  if (item.iconPath) {
    icon.appendChild(createIconImage(item.iconPath, icon));
    return icon;
  }

  icon.textContent = '📦';
  void loadIcon(item.icon).then((p) => {
    if (p) icon.replaceChildren(createIconImage(p, icon));
  });
  return icon;
}

/**
 * Builds the `<img>` for an icon. The path is percent-encoded per segment: it
 * originates from a `.desktop` file on disk rather than from us, and splicing
 * it raw into a `file://` URL would let characters such as `#` or `?` change
 * which file actually gets loaded.
 */
function createIconImage(iconPath: string, container: HTMLElement): HTMLImageElement {
  const img = document.createElement('img');
  img.src = `file://${iconPath.split('/').map(encodeURIComponent).join('/')}`;
  img.alt = '';
  img.onerror = () => {
    container.textContent = '📦';
  };
  return img;
}

function executeCommand(item: SearchResult, showFolder = false): void {
  if (showFolder && (item.type === 'file' || item.type === 'app') && item.path) {
    api.send('item-show-folder', item.path);
    return;
  }

  switch (item.type) {
    case 'app':
    case 'file':
      if (item.path) api.send('app-launch', item.path);
      break;
    case 'command':
    case 'syscommand':
      if (item.action) api.send('command-run', item.action);
      break;
    case 'alias':
      // Only the alias name is sent; the main process resolves it against its
      // own config rather than trusting a command list from the renderer.
      if (item.aliasKey) api.send('alias-run', item.aliasKey);
      break;
    case 'web':
      if (item.url) api.send('url-open', item.url);
      break;
    case 'calc':
    case 'clipboard':
      api.send('clipboard-copy', item.value || item.name);
      break;
  }
}

export function executeItem(item: SearchResult, showFolder = false): void {
  const selected = dom.resultsContainer.querySelector<HTMLElement>('.result-item.selected');
  if (selected) {
    selected.style.transform = 'scale(0.96)';
    setTimeout(() => executeCommand(item, showFolder), 50);
  } else {
    executeCommand(item, showFolder);
  }
}

export function selectItem(index: number, doScroll = true): void {
  const items = dom.resultsContainer.querySelectorAll<HTMLElement>('.result-item');
  items.forEach((item, i) => {
    if (i === index) {
      item.classList.add('selected');
      if (doScroll) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
  state.selectedIndex = index;
}

function createResultElement(item: SearchResult, index: number): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'result-item';
  div.dataset.index = String(index);
  div.style.setProperty('--index', String(index));

  div.appendChild(buildIcon(item));

  const content = document.createElement('div');
  content.className = 'result-content';
  const title = document.createElement('div');
  title.className = 'result-title';
  title.textContent = item.name;
  content.appendChild(title);

  if (item.description) {
    const desc = document.createElement('div');
    desc.className = 'result-desc';
    desc.textContent = item.description;
    content.appendChild(desc);
  }
  div.appendChild(content);

  const dict = getDict(state.appSettings?.language);
  const labelKey = TYPE_LABEL_KEYS[item.type] ?? 'type_default';
  const badge = document.createElement('div');
  badge.className = 'result-badge';
  badge.textContent = dict[labelKey];
  div.appendChild(badge);

  if (item.type === 'weather') div.classList.add('weather-card');

  div.addEventListener('click', (e) => executeItem(item, e.shiftKey));
  div.addEventListener('mouseenter', () => selectItem(index, false));

  return div;
}

/** Builds the magnifier glyph used by the empty state. */
function createSearchGlyph(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const circle = document.createElementNS(ns, 'circle');
  circle.setAttribute('cx', '11');
  circle.setAttribute('cy', '11');
  circle.setAttribute('r', '8');
  const handle = document.createElementNS(ns, 'line');
  handle.setAttribute('x1', '21');
  handle.setAttribute('y1', '21');
  handle.setAttribute('x2', '16.65');
  handle.setAttribute('y2', '16.65');

  svg.appendChild(circle);
  svg.appendChild(handle);
  return svg;
}

function renderEmptyState(query: string): void {
  const dict = getDict(state.appSettings?.language);

  const wrapper = document.createElement('div');
  wrapper.className = 'no-results fade-in';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'no-results-icon';
  iconWrap.appendChild(createSearchGlyph());
  wrapper.appendChild(iconWrap);

  const text = document.createElement('div');
  text.className = 'no-results-text';
  // `textContent`, so the query needs no escaping — it is never parsed as
  // markup.
  text.textContent = `${dict.no_results} "${query}"`;
  wrapper.appendChild(text);

  dom.resultsContainer.replaceChildren(wrapper);
}

export function renderResults(results: SearchResult[]): void {
  dom.resultsContainer.replaceChildren();
  state.selectedIndex = -1;

  if (results.length === 0) {
    dom.footer.style.display = 'none';
    if (dom.searchInput.value) renderEmptyState(dom.searchInput.value);
    updateWindowSize();
    return;
  }

  dom.footer.style.display = 'flex';
  results.forEach((item, index) => {
    dom.resultsContainer.appendChild(createResultElement(item, index));
  });

  selectItem(0, false);
  updateWindowSize();
}

export function clearResults(): void {
  state.currentResults = [];
  state.selectedIndex = -1;
  dom.resultsContainer.replaceChildren();
  dom.footer.style.display = 'none';
  updateWindowSize();
}

export async function performSearch(query: string): Promise<void> {
  const searchId = ++state.lastSearchId;
  try {
    const results = await api.invoke('search', query);
    // Paranoid guard: drop the result if a newer search has already been dispatched.
    if (searchId !== state.lastSearchId) return;

    state.currentResults = results || [];
    renderResults(state.currentResults);
  } catch (error) {
    if (searchId !== state.lastSearchId) return;
    console.error('Search error:', error);
    state.currentResults = [];
    renderResults([]);
  }
}
