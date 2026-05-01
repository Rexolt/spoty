import { dom } from './dom';
import { api } from './electron-api';
import { state } from './state';
import { getDict, type DictKey } from './i18n';
import { escapeHtml } from './utils';
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
      icon.innerHTML = '⛅';
      return icon;
    case 'calc':
      icon.innerHTML = '🧮';
      return icon;
    case 'command':
      icon.innerHTML = '⚡';
      return icon;
    case 'syscommand':
      icon.innerHTML = '⚙️';
      return icon;
    case 'web':
      icon.innerHTML = '🌐';
      return icon;
    case 'clipboard':
      icon.innerHTML = '📋';
      return icon;
    case 'file':
      icon.innerHTML = '📄';
      return icon;
  }

  if (item.iconPath) {
    const img = document.createElement('img');
    img.src = `file://${item.iconPath}`;
    img.onerror = () => {
      icon.innerHTML = '📦';
    };
    icon.appendChild(img);
    return icon;
  }

  icon.innerHTML = '📦';
  void loadIcon(item.icon).then((p) => {
    if (p) {
      const img = document.createElement('img');
      img.src = `file://${p}`;
      icon.innerHTML = '';
      icon.appendChild(img);
    }
  });
  return icon;
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
      if (item.commands) api.send('alias-run', item.commands);
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

export function renderResults(results: SearchResult[]): void {
  dom.resultsContainer.innerHTML = '';
  state.selectedIndex = -1;

  if (results.length === 0) {
    dom.footer.style.display = 'none';
    if (dom.searchInput.value) {
      const dict = getDict(state.appSettings?.language);
      dom.resultsContainer.innerHTML = `
        <div class="no-results fade-in">
          <div class="no-results-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <div class="no-results-text">${dict.no_results} "${escapeHtml(dom.searchInput.value)}"</div>
        </div>
      `;
    }
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
  dom.resultsContainer.innerHTML = '';
  dom.footer.style.display = 'none';
  updateWindowSize();
}

export async function performSearch(query: string): Promise<void> {
  try {
    const results = await api.invoke('search', query);
    state.currentResults = results || [];
    renderResults(state.currentResults);
  } catch (error) {
    console.error('Search error:', error);
    state.currentResults = [];
    renderResults([]);
  }
}
