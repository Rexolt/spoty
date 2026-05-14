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
    // Use the actual scrollHeight of the results container for a more robust measurement
    // than summing up children offsetHeights.
    const resultsScrollHeight = dom.resultsContainer.scrollHeight;
    
    const footerHeight = dom.footer.style.display !== 'none' ? dom.footer.offsetHeight : 0;
    
    // If we have results, add a small buffer for the bottom padding/margin
    const padding = resultsScrollHeight > 0 ? 12 : 0;
    const actualResultsHeight = Math.min(resultsScrollHeight, MAX_RESULTS_HEIGHT);
    
    const totalHeight =
      HEADER_HEIGHT + SEARCH_HEIGHT + actualResultsHeight + footerHeight + padding;

    api.send('window-resize', Math.ceil(totalHeight));
  }, RESIZE_DEBOUNCE_MS);
}

export function updateWindowSizeForSettings(): void {
  api.send('window-resize', SETTINGS_HEIGHT);
}
