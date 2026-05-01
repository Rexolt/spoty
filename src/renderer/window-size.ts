import { dom } from './dom';
import { api } from './electron-api';

const HEADER_HEIGHT = 44;
const SEARCH_HEIGHT = 64;
const MAX_RESULTS_HEIGHT = 450;
const SETTINGS_HEIGHT = 520;
const RESIZE_DEBOUNCE_MS = 30;

export function updateWindowSize(): void {
  if (dom.settingsOverlay.style.display !== 'none') return;

  setTimeout(() => {
    let resultsHeight = 0;
    Array.from(dom.resultsContainer.children).forEach((child) => {
      const node = child as HTMLElement;
      const style = window.getComputedStyle(node);
      const mt = parseFloat(style.marginTop) || 0;
      const mb = parseFloat(style.marginBottom) || 0;
      resultsHeight += node.offsetHeight + mt + mb;
    });
    const footerHeight = dom.footer.style.display !== 'none' ? dom.footer.offsetHeight : 0;
    const padding = resultsHeight > 0 ? 16 : 0;
    const actualResultsHeight = Math.min(resultsHeight, MAX_RESULTS_HEIGHT);
    const totalHeight =
      HEADER_HEIGHT + SEARCH_HEIGHT + actualResultsHeight + footerHeight + padding;

    api.send('window-resize', totalHeight);
  }, RESIZE_DEBOUNCE_MS);
}

export function updateWindowSizeForSettings(): void {
  api.send('window-resize', SETTINGS_HEIGHT);
}
